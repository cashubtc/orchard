/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import * as os from 'os';
import {promises as fs} from 'fs';
/* Vendor Dependencies */
import {FindOptionsWhere, Repository, LessThan, Between, In} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {round2} from '@server/modules/math/round';
/* Local Dependencies */
import {SystemMetrics} from './sysmetrics.entity.js';
import {SystemMetric} from './sysmetrics.enums.js';
import {METRICS_RETENTION_DAYS, METRICS_DOWNSAMPLE_AFTER_DAYS} from './sysmetrics.constants.js';

const CPU_SAMPLE_INTERVAL_MS = 100;

@Injectable()
export class SystemMetricsService {
	private readonly logger = new Logger(SystemMetricsService.name);

	private previous_cpu_usage: NodeJS.CpuUsage | null = null;
	private previous_cpu_sample_at: bigint | null = null;

	constructor(
		@InjectRepository(SystemMetrics)
		private systemMetricsRepository: Repository<SystemMetrics>,
	) {}

	/* *******************************************************
		Collection
	******************************************************** */

	/**
	 * Samples all system metrics and stores them for the current minute
	 */
	async collectAndStore(): Promise<void> {
		const now = DateTime.utc();
		const minute_start = now.startOf('minute').toUnixInteger();
		const updated_at = now.toUnixInteger();

		const samples = await this.sampleAll();

		const rows = Object.entries(samples)
			.filter(([, value]) => value !== null)
			.map(([metric, value]) => ({
				metric,
				date: minute_start,
				value: value as number,
				updated_at,
			}));

		await this.systemMetricsRepository.upsert(rows, {conflictPaths: ['metric', 'date']});
	}

	/**
	 * Samples all system metrics and returns them as a map; null values are skipped
	 */
	private async sampleAll(): Promise<Record<string, number | null>> {
		const [cpu_percent, disk_percent] = await Promise.all([this.sampleCpuPercent(), this.sampleDiskPercent()]);

		const total_mem = os.totalmem();
		const free_mem = os.freemem();
		const memory_percent = ((total_mem - free_mem) / total_mem) * 100;

		const [load_1m, load_5m, load_15m] = os.loadavg();

		const heap = process.memoryUsage();
		const heap_used_mb = heap.heapUsed / (1024 * 1024);
		const heap_total_mb = heap.heapTotal / (1024 * 1024);
		const memory_rss_mb = heap.rss / (1024 * 1024);
		const memory_external_mb = heap.external / (1024 * 1024);

		return {
			[SystemMetric.cpu_percent]: round2(cpu_percent),
			[SystemMetric.memory_percent]: round2(memory_percent),
			[SystemMetric.memory_rss_mb]: round2(memory_rss_mb),
			[SystemMetric.disk_percent]: round2(disk_percent),
			[SystemMetric.load_avg_1m]: round2(load_1m),
			[SystemMetric.load_avg_5m]: round2(load_5m),
			[SystemMetric.load_avg_15m]: round2(load_15m),
			[SystemMetric.heap_used_mb]: round2(heap_used_mb),
			[SystemMetric.heap_total_mb]: round2(heap_total_mb),
			[SystemMetric.memory_external_mb]: round2(memory_external_mb),
			[SystemMetric.process_cpu_percent]: this.sampleProcessCpuPercent(),
			[SystemMetric.uptime_system]: Math.floor(os.uptime()),
			[SystemMetric.uptime_process]: Math.floor(process.uptime()),
		};
	}

	/**
	 * Process CPU usage since the previous tick as a % of total machine capacity;
	 * null on the first tick (no prior sample to delta against)
	 */
	private sampleProcessCpuPercent(): number | null {
		const now = process.hrtime.bigint();
		const usage = process.cpuUsage();
		const previous_usage = this.previous_cpu_usage;
		const previous_at = this.previous_cpu_sample_at;
		this.previous_cpu_usage = usage;
		this.previous_cpu_sample_at = now;
		if (previous_usage === null || previous_at === null) return null;
		const elapsed_us = Number(now - previous_at) / 1000;
		if (elapsed_us <= 0) return null;
		const used_us = usage.user - previous_usage.user + usage.system - previous_usage.system;
		const cores = os.availableParallelism();
		return round2(Math.min(100, (used_us / (elapsed_us * cores)) * 100));
	}

	/**
	 * Computes CPU usage percentage by sampling twice with a short interval
	 */
	private async sampleCpuPercent(): Promise<number> {
		const start = os.cpus();
		await new Promise((resolve) => setTimeout(resolve, CPU_SAMPLE_INTERVAL_MS));
		const end = os.cpus();

		let total_idle = 0;
		let total_tick = 0;

		for (let i = 0; i < start.length; i++) {
			const start_cpu = start[i].times;
			const end_cpu = end[i].times;

			const idle_diff = end_cpu.idle - start_cpu.idle;
			const total_diff =
				end_cpu.user -
				start_cpu.user +
				end_cpu.nice -
				start_cpu.nice +
				end_cpu.sys -
				start_cpu.sys +
				end_cpu.idle -
				start_cpu.idle +
				end_cpu.irq -
				start_cpu.irq;

			total_idle += idle_diff;
			total_tick += total_diff;
		}

		return total_tick === 0 ? 0 : ((total_tick - total_idle) / total_tick) * 100;
	}

	/**
	 * Gets disk usage percentage for the root filesystem
	 */
	private async sampleDiskPercent(): Promise<number> {
		try {
			const stats = await fs.statfs('/');
			const total = stats.blocks * stats.bsize;
			const free = stats.bfree * stats.bsize;
			return ((total - free) / total) * 100;
		} catch (error) {
			this.logger.warn(`Failed to sample disk stats: ${error.message}`);
			return 0;
		}
	}

	/* *******************************************************
		Query
	******************************************************** */

	/**
	 * Gets stored metrics for a date range
	 */
	async getMetrics(date_start: number, date_end: number, metrics?: SystemMetric[]): Promise<SystemMetrics[]> {
		if (date_end < date_start) return [];

		const where: FindOptionsWhere<SystemMetrics> = {
			date: Between(date_start, date_end),
		};

		if (metrics?.length) {
			where.metric = In(metrics);
		}

		return this.systemMetricsRepository.find({
			where,
			order: {date: 'ASC'},
		});
	}

	/* *******************************************************
		Cleanup
	******************************************************** */

	/**
	 * Deletes records older than METRICS_RETENTION_DAYS and downsamples
	 * minute-granularity data older than METRICS_DOWNSAMPLE_AFTER_DAYS to hourly
	 */
	async cleanupOldMetrics(): Promise<void> {
		const now = DateTime.utc();

		// Delete records older than retention period
		const retention_cutoff = now.minus({days: METRICS_RETENTION_DAYS}).startOf('minute').toUnixInteger();
		const deleted = await this.systemMetricsRepository.delete({
			date: LessThan(retention_cutoff),
		});
		if (deleted.affected) {
			this.logger.log(`Deleted ${deleted.affected} system metrics older than ${METRICS_RETENTION_DAYS} days`);
		}

		// Downsample minute data older than METRICS_DOWNSAMPLE_AFTER_DAYS to hourly
		await this.downsampleToHourly(now);
	}

	/**
	 * Downsamples minute-granularity data to hourly by averaging values
	 * for records older than METRICS_DOWNSAMPLE_AFTER_DAYS.
	 * Uses SQL GROUP BY to avoid loading all rows into memory.
	 */
	private async downsampleToHourly(now: DateTime): Promise<void> {
		const downsample_cutoff = now.minus({days: METRICS_DOWNSAMPLE_AFTER_DAYS}).startOf('hour').toUnixInteger();
		const retention_cutoff = now.minus({days: METRICS_RETENTION_DAYS}).startOf('hour').toUnixInteger();
		const updated_at = now.toUnixInteger();

		// Aggregate in SQL: group by metric + hour bucket, compute averages
		const hourly_averages: {metric: string; hour_bucket: number; avg_value: number; row_count: number}[] =
			await this.systemMetricsRepository
				.createQueryBuilder('m')
				.select('m.metric', 'metric')
				.addSelect('(m.date - (m.date % 3600))', 'hour_bucket')
				.addSelect('AVG(m.value)', 'avg_value')
				.addSelect('COUNT(*)', 'row_count')
				.where('m.date >= :start AND m.date < :end', {start: retention_cutoff, end: downsample_cutoff})
				.groupBy('m.metric')
				.addGroupBy('hour_bucket')
				.getRawMany();

		if (hourly_averages.length === 0) return;

		const total_rows = hourly_averages.reduce((sum, r) => sum + Number(r.row_count), 0);

		const rows = hourly_averages.map((r) => ({
			metric: r.metric,
			date: Number(r.hour_bucket),
			value: round2(Number(r.avg_value)),
			updated_at,
		}));

		// Delete + insert in a transaction to prevent data loss on crash
		await this.systemMetricsRepository.manager.transaction(async (manager) => {
			await manager
				.createQueryBuilder()
				.delete()
				.from(SystemMetrics)
				.where('date >= :start AND date < :end', {start: retention_cutoff, end: downsample_cutoff})
				.execute();

			await manager.upsert(SystemMetrics, rows, {conflictPaths: ['metric', 'date']});
		});

		this.logger.log(`Downsampled ${total_rows} minute records into ${hourly_averages.length} hourly records`);
	}
}
