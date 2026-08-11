/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {type FindOptionsWhere, Repository, LessThan, Between, In} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {PrometheusService} from '#server/modules/prometheus/prometheus.service';
import {flattenFamily} from '#server/modules/prometheus/prometheus.helpers';
import type {PromFamily} from '#server/modules/prometheus/prometheus.types';
import {METRICS_RETENTION_DAYS, METRICS_DOWNSAMPLE_AFTER_DAYS} from '#server/modules/system/metrics/sysmetrics.constants';
import {MintType} from '#server/modules/cashu/cashu.enums';
/* Local Dependencies */
import {MintMetrics} from './mintmetrics.entity.js';
import {MintMetricType} from './mintmetrics.enums.js';

const STORED_FAMILY_REGEX = /^(cdk_|process_)/;
const MAX_LABEL_SETS_PER_FAMILY = 100;
const MAX_BUCKETS_PER_SERIES = 64;

type MintMetricsRow = Omit<MintMetrics, 'id'>;
type HourlyCumulativeSnapshot = Pick<MintMetrics, 'value' | 'sum' | 'count' | 'buckets'>;

@Injectable()
export class MintMetricsService {
	private readonly logger = new Logger(MintMetricsService.name);

	private mint_reachable: boolean | null = null;
	private warned_families = new Set<string>();
	private collecting = false;

	constructor(
		@InjectRepository(MintMetrics)
		private mintMetricsRepository: Repository<MintMetrics>,
		private prometheusService: PrometheusService,
		private configService: ConfigService,
	) {}

	/**
	 * Determines whether Prometheus metrics are supported and configured for the active mint.
	 * @returns {boolean} True when a CDK mint metrics endpoint is configured
	 */
	public isEnabled(): boolean {
		if (this.configService.get<string>('cashu.type') !== MintType.CDK) return false;
		return !!this.configService.get<string>('cashu.metrics_api');
	}

	/* *******************************************************
		Collection
	******************************************************** */

	/**
	 * Scrapes the mint prometheus exporter
	 * @returns {Promise<PromFamily[]>} Parsed metric families
	 */
	async scrapeMintMetrics(): Promise<PromFamily[]> {
		const metrics_api = this.configService.get<string>('cashu.metrics_api');
		if (!metrics_api) return [];
		return this.prometheusService.scrapeMetrics(`${metrics_api}/metrics`);
	}

	/**
	 * Scrapes the mint prometheus exporter and stores samples for the current minute
	 * Never throws when the mint is unreachable; logs once on state transitions
	 * Skips the run when a previous collection is still in flight, so slow scrapes can't stack across ticks
	 */
	async collectAndStore(): Promise<void> {
		if (this.collecting) {
			this.logger.warn('Mint metrics collection already in progress, skipping this run');
			return;
		}
		this.collecting = true;
		try {
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
		} finally {
			this.collecting = false;
		}
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

			const family_series = flattenFamily(family);
			if (family_series.length > MAX_LABEL_SETS_PER_FAMILY) {
				this.warnCardinalityExceeded(family.name, family_series.length);
				continue;
			}

			rows.push(
				...family_series.map((series) => ({
					metric: series.name,
					labels: series.labels,
					type: series.type as MintMetricType,
					value: series.value,
					sum: series.sum,
					count: series.count,
					buckets: this.serializeBuckets(series.buckets),
					date: minute_start,
					updated_at,
				})),
			);
		}

		return rows;
	}

	/**
	 * Serializes a histogram bucket map to JSON, dropping pathological series that exceed the bucket cap
	 */
	private serializeBuckets(buckets: Record<string, number> | null): string | null {
		if (!buckets) return null;
		if (Object.keys(buckets).length > MAX_BUCKETS_PER_SERIES) return null;
		return JSON.stringify(buckets);
	}

	/**
	 * Logs a cardinality warning once per metric family
	 */
	private warnCardinalityExceeded(family_name: string, label_set_count: number): void {
		if (this.warned_families.has(family_name)) return;
		this.warned_families.add(family_name);
		this.logger.warn(`Skipping metric family ${family_name}: ${label_set_count} label sets exceeds cardinality limit`);
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
	 * Deletes records older than METRICS_RETENTION_DAYS and downsamples
	 * minute-granularity data older than METRICS_DOWNSAMPLE_AFTER_DAYS to hourly
	 */
	async cleanupOldMetrics(): Promise<void> {
		const now = DateTime.utc();
		const retention_cutoff = now.minus({days: METRICS_RETENTION_DAYS}).startOf('minute').toUnixInteger();
		const deleted = await this.mintMetricsRepository.delete({
			date: LessThan(retention_cutoff),
		});
		if (deleted.affected) {
			this.logger.log(`Deleted ${deleted.affected} mint metrics older than ${METRICS_RETENTION_DAYS} days`);
		}
		await this.downsampleToHourly(now);
	}

	/**
	 * Downsamples minute-granularity data to hourly for records older than METRICS_DOWNSAMPLE_AFTER_DAYS.
	 * Gauges keep the hourly average; counters and histograms keep the latest chronological
	 * snapshot so cumulative query-time deltas remain correct across process resets.
	 */
	private async downsampleToHourly(now: DateTime): Promise<void> {
		const downsample_cutoff = now.minus({days: METRICS_DOWNSAMPLE_AFTER_DAYS}).startOf('hour').toUnixInteger();
		const retention_cutoff = now.minus({days: METRICS_RETENTION_DAYS}).startOf('hour').toUnixInteger();
		const updated_at = now.toUnixInteger();

		const hourly_buckets: {
			metric: string;
			labels: string;
			type: string;
			hour_bucket: number;
			avg_value: number | null;
			row_count: number;
		}[] = await this.mintMetricsRepository
			.createQueryBuilder('m')
			.select('m.metric', 'metric')
			.addSelect('m.labels', 'labels')
			.addSelect('MAX(m.type)', 'type')
			.addSelect('(m.date - (m.date % 3600))', 'hour_bucket')
			.addSelect('AVG(m.value)', 'avg_value')
			.addSelect('COUNT(*)', 'row_count')
			.where('m.date >= :start AND m.date < :end', {start: retention_cutoff, end: downsample_cutoff})
			.groupBy('m.metric')
			.addGroupBy('m.labels')
			.addGroupBy('hour_bucket')
			.getRawMany();

		if (hourly_buckets.length === 0) return;

		const total_rows = hourly_buckets.reduce((sum, r) => sum + Number(r.row_count), 0);
		const hourly_cumulative_snapshots = await this.getHourlyCumulativeSnapshots(retention_cutoff, downsample_cutoff);

		// Gauges keep the hourly average; counters and histograms keep the final snapshot
		const toNumber = (v: number | null): number | null => (v !== null ? Number(v) : null);
		const rows = hourly_buckets.map((r) => {
			const snapshot = hourly_cumulative_snapshots.get(`${r.metric}|${r.labels}|${Number(r.hour_bucket)}`);
			return {
				metric: r.metric,
				labels: r.labels,
				type: r.type,
				date: Number(r.hour_bucket),
				value: toNumber(r.type === MintMetricType.gauge ? r.avg_value : (snapshot?.value ?? null)),
				sum: toNumber(snapshot?.sum ?? null),
				count: toNumber(snapshot?.count ?? null),
				buckets: snapshot?.buckets ?? null,
				updated_at,
			};
		});

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

	/**
	 * Loads the latest counter or histogram snapshot per series per hour.
	 * A self anti-join selects by timestamp rather than cumulative value, which remains correct when a process reset occurs within the hour.
	 * @param {number} start - Inclusive unix timestamp for the downsample window.
	 * @param {number} end - Exclusive unix timestamp for the downsample window.
	 * @returns {Promise<Map<string, HourlyCumulativeSnapshot>>} Latest cumulative snapshot keyed by metric, labels, and hour.
	 */
	private async getHourlyCumulativeSnapshots(start: number, end: number): Promise<Map<string, HourlyCumulativeSnapshot>> {
		const snapshot_rows: (HourlyCumulativeSnapshot & {metric: string; labels: string; hour_bucket: number})[] =
			await this.mintMetricsRepository
				.createQueryBuilder('m')
				.select('m.metric', 'metric')
				.addSelect('m.labels', 'labels')
				.addSelect('(m.date - (m.date % 3600))', 'hour_bucket')
				.addSelect('m.value', 'value')
				.addSelect('m.sum', 'sum')
				.addSelect('m.count', 'count')
				.addSelect('m.buckets', 'buckets')
				.leftJoin(
					MintMetrics,
					'newer',
					'newer.metric = m.metric AND newer.labels = m.labels AND ' +
						'(newer.date - (newer.date % 3600)) = (m.date - (m.date % 3600)) AND newer.date > m.date',
				)
				.where('m.date >= :start AND m.date < :end', {start, end})
				.andWhere('m.type IN (:...types)', {types: [MintMetricType.counter, MintMetricType.histogram]})
				.andWhere('newer.id IS NULL')
				.getRawMany();

		const snapshots = new Map<string, HourlyCumulativeSnapshot>();
		for (const row of snapshot_rows) {
			const key = `${row.metric}|${row.labels}|${Number(row.hour_bucket)}`;
			snapshots.set(key, {
				value: row.value !== null ? Number(row.value) : null,
				sum: row.sum !== null ? Number(row.sum) : null,
				count: row.count !== null ? Number(row.count) : null,
				buckets: row.buckets,
			});
		}

		return snapshots;
	}
}
