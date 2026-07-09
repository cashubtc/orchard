/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {FindOptionsWhere, Repository, LessThan, Between, In} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {PrometheusService} from '@server/modules/prometheus/prometheus.service';
import {canonicalizeLabels} from '@server/modules/prometheus/prometheus.helpers';
import {PromFamily} from '@server/modules/prometheus/prometheus.types';
import {SettingService} from '@server/modules/setting/setting.service';
import {SettingKey} from '@server/modules/setting/setting.enums';
/* Local Dependencies */
import {MintMetrics} from './mintmetrics.entity';
import {MintMetricType} from './mintmetrics.enums';

const RETENTION_DAYS = 90;
const DOWNSAMPLE_AFTER_DAYS = 7;
const STORED_FAMILY_REGEX = /^(cdk_|process_)/;
const MAX_LABEL_SETS_PER_FAMILY = 100;

type MintMetricsRow = Omit<MintMetrics, 'id'>;

@Injectable()
export class MintMetricsService {
	private readonly logger = new Logger(MintMetricsService.name);

	private mint_reachable: boolean | null = null;
	private warned_families = new Set<string>();

	constructor(
		@InjectRepository(MintMetrics)
		private mintMetricsRepository: Repository<MintMetrics>,
		private prometheusService: PrometheusService,
		private settingService: SettingService,
	) {}

	/* *******************************************************
		Collection
	******************************************************** */

	/**
	 * Scrapes the mint prometheus exporter
	 * @returns {Promise<PromFamily[]>} Parsed metric families
	 */
	async scrapeMintMetrics(): Promise<PromFamily[]> {
		const metrics_api = await this.settingService.getStringSetting(SettingKey.MINT_METRICS_API);
		if (!metrics_api) return [];
		return this.prometheusService.scrapeMetrics(`${metrics_api}/metrics`);
	}

	/**
	 * Scrapes the mint prometheus exporter and stores samples for the current minute
	 * Never throws when the mint is unreachable; logs once on state transitions
	 */
	async collectAndStore(): Promise<void> {
		let families: PromFamily[];
		try {
			families = await this.scrapeMintMetrics();
		} catch (error) {
			if (this.mint_reachable !== false) {
				this.logger.warn(`Mint metrics endpoint unreachable: ${error.message}`);
			}
			this.mint_reachable = false;
			return;
		}
		if (this.mint_reachable === false) this.logger.log('Mint metrics endpoint reachable again, resuming collection');
		this.mint_reachable = true;
		const rows = this.buildRows(families);
		if (rows.length === 0) return;
		await this.mintMetricsRepository.upsert(rows, {conflictPaths: ['metric', 'labels', 'date']});
	}

	/**
	 * Converts scraped families into minute-bucket rows for storage
	 */
	private buildRows(families: PromFamily[]): MintMetricsRow[] {
		const now = DateTime.utc();
		const minute_start = now.startOf('minute').toUnixInteger();
		const updated_at = now.toUnixInteger();
		const rows: MintMetricsRow[] = [];

		for (const family of families) {
			if (!STORED_FAMILY_REGEX.test(family.name)) continue;
			if (family.type !== 'gauge' && family.type !== 'counter' && family.type !== 'histogram') continue;

			const family_rows = family.type === 'histogram' ? this.buildHistogramRows(family) : this.buildSampleRows(family);
			if (family_rows.length > MAX_LABEL_SETS_PER_FAMILY) {
				this.warnCardinalityExceeded(family.name, family_rows.length);
				continue;
			}

			rows.push(...family_rows.map((row) => ({...row, date: minute_start, updated_at})));
		}

		return rows;
	}

	/**
	 * Logs a cardinality warning once per metric family
	 */
	private warnCardinalityExceeded(family_name: string, label_set_count: number): void {
		if (this.warned_families.has(family_name)) return;
		this.warned_families.add(family_name);
		this.logger.warn(`Skipping metric family ${family_name}: ${label_set_count} label sets exceeds cardinality limit`);
	}

	/**
	 * Builds partial rows for gauge/counter families
	 */
	private buildSampleRows(family: PromFamily): Omit<MintMetricsRow, 'date' | 'updated_at'>[] {
		return family.samples.map((sample) => ({
			metric: family.name,
			labels: canonicalizeLabels(sample.labels),
			type: family.type as MintMetricType,
			value: sample.value,
			sum: null,
			count: null,
		}));
	}

	/**
	 * Builds partial rows for histogram families by zipping sum and count samples per label set
	 */
	private buildHistogramRows(family: PromFamily): Omit<MintMetricsRow, 'date' | 'updated_at'>[] {
		const counts = new Map<string, number>();
		for (const sample of family.count_samples ?? []) {
			counts.set(canonicalizeLabels(sample.labels), sample.value);
		}
		return (family.sum_samples ?? []).map((sample) => {
			const labels = canonicalizeLabels(sample.labels);
			return {
				metric: family.name,
				labels,
				type: MintMetricType.histogram,
				value: null,
				sum: sample.value,
				count: counts.get(labels) ?? 0,
			};
		});
	}

	/* *******************************************************
		Query
	******************************************************** */

	/**
	 * Gets stored metrics for a date range
	 */
	async getMetrics(date_start: number, date_end: number, metrics?: string[]): Promise<MintMetrics[]> {
		if (date_end < date_start) return [];
		const where: FindOptionsWhere<MintMetrics> = {
			date: Between(date_start, date_end),
		};
		if (metrics?.length) where.metric = In(metrics);
		return this.mintMetricsRepository.find({
			where,
			order: {date: 'ASC'},
		});
	}

	/* *******************************************************
		Cleanup
	******************************************************** */

	/**
	 * Deletes records older than RETENTION_DAYS and downsamples
	 * minute-granularity data older than DOWNSAMPLE_AFTER_DAYS to hourly
	 */
	async cleanupOldMetrics(): Promise<void> {
		const now = DateTime.utc();
		const retention_cutoff = now.minus({days: RETENTION_DAYS}).startOf('minute').toUnixInteger();
		const deleted = await this.mintMetricsRepository.delete({
			date: LessThan(retention_cutoff),
		});
		if (deleted.affected) {
			this.logger.log(`Deleted ${deleted.affected} mint metrics older than ${RETENTION_DAYS} days`);
		}
		await this.downsampleToHourly(now);
	}

	/**
	 * Downsamples minute-granularity data to hourly for records older than DOWNSAMPLE_AFTER_DAYS.
	 * Gauges keep the hourly average; counters and histograms keep the hourly max so
	 * cumulative last-value semantics (and query-time deltas) stay correct.
	 */
	private async downsampleToHourly(now: DateTime): Promise<void> {
		const downsample_cutoff = now.minus({days: DOWNSAMPLE_AFTER_DAYS}).startOf('hour').toUnixInteger();
		const retention_cutoff = now.minus({days: RETENTION_DAYS}).startOf('hour').toUnixInteger();
		const updated_at = now.toUnixInteger();

		const hourly_buckets: {
			metric: string;
			labels: string;
			type: string;
			hour_bucket: number;
			avg_value: number | null;
			max_value: number | null;
			max_sum: number | null;
			max_count: number | null;
			row_count: number;
		}[] = await this.mintMetricsRepository
			.createQueryBuilder('m')
			.select('m.metric', 'metric')
			.addSelect('m.labels', 'labels')
			.addSelect('MAX(m.type)', 'type')
			.addSelect('(m.date - (m.date % 3600))', 'hour_bucket')
			.addSelect('AVG(m.value)', 'avg_value')
			.addSelect('MAX(m.value)', 'max_value')
			.addSelect('MAX(m.sum)', 'max_sum')
			.addSelect('MAX(m.count)', 'max_count')
			.addSelect('COUNT(*)', 'row_count')
			.where('m.date >= :start AND m.date < :end', {start: retention_cutoff, end: downsample_cutoff})
			.groupBy('m.metric')
			.addGroupBy('m.labels')
			.addGroupBy('hour_bucket')
			.getRawMany();

		if (hourly_buckets.length === 0) return;

		const total_rows = hourly_buckets.reduce((sum, r) => sum + Number(r.row_count), 0);

		// Gauges keep the hourly average; counters and histograms keep the hourly max
		const toNumber = (v: number | null): number | null => (v !== null ? Number(v) : null);
		const rows = hourly_buckets.map((r) => ({
			metric: r.metric,
			labels: r.labels,
			type: r.type,
			date: Number(r.hour_bucket),
			value: toNumber(r.type === MintMetricType.gauge ? r.avg_value : r.max_value),
			sum: toNumber(r.max_sum),
			count: toNumber(r.max_count),
			updated_at,
		}));

		await this.mintMetricsRepository.manager.transaction(async (manager) => {
			await manager
				.createQueryBuilder()
				.delete()
				.from(MintMetrics)
				.where('date >= :start AND date < :end', {start: retention_cutoff, end: downsample_cutoff})
				.execute();

			await manager.upsert(MintMetrics, rows, {conflictPaths: ['metric', 'labels', 'date']});
		});

		this.logger.log(`Downsampled ${total_rows} minute records into ${hourly_buckets.length} hourly records`);
	}
}
