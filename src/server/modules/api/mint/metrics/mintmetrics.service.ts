/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
import {MintType} from '@server/modules/cashu/cashu.enums';
import {SettingService} from '@server/modules/setting/setting.service';
import {SettingKey} from '@server/modules/setting/setting.enums';
import {MintMetricsService} from '@server/modules/cashu/mintmetrics/mintmetrics.service';
import {MintMetrics} from '@server/modules/cashu/mintmetrics/mintmetrics.entity';
import {MintMetricType} from '@server/modules/cashu/mintmetrics/mintmetrics.enums';
import {SystemMetricsInterval} from '@server/modules/system/metrics/sysmetrics.enums';
import {flattenFamily} from '@server/modules/prometheus/prometheus.helpers';
/* Local Dependencies */
import {OrchardMintMetrics, OrchardMintMetricsSnapshot} from './mintmetrics.model';

interface MintMetricsArgs {
	date_start?: number;
	date_end?: number;
	interval?: SystemMetricsInterval;
	timezone?: string;
	metrics?: string[];
}

@Injectable()
export class ApiMintMetricsService {
	private readonly logger = new Logger(ApiMintMetricsService.name);

	constructor(
		private mintMetricsService: MintMetricsService,
		private configService: ConfigService,
		private settingService: SettingService,
		private errorService: ErrorService,
	) {}

	/**
	 * Gets stored mint server metrics with interval aggregation
	 * Gauges aggregate avg/min/max; counters and histograms aggregate per-interval deltas
	 */
	async getMetrics(tag: string, args: MintMetricsArgs): Promise<OrchardMintMetrics[]> {
		try {
			await this.guardSupport();
			const now = DateTime.utc().toUnixInteger();
			const interval = args.interval ?? SystemMetricsInterval.minute;
			const date_start = args.date_start ?? DateTime.utc().minus({days: 1}).toUnixInteger();
			const date_end = args.date_end ?? now;
			const data = await this.mintMetricsService.getMetrics(date_start, date_end, args.metrics);
			return this.aggregateByInterval(data, interval, args.timezone);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintMetricsError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Gets a live snapshot of the mint prometheus exporter
	 */
	async getSnapshot(tag: string): Promise<OrchardMintMetricsSnapshot[]> {
		try {
			await this.guardSupport();
			const families = await this.mintMetricsService.scrapeMintMetrics();
			return families.flatMap((family) => {
				if (family.type !== 'gauge' && family.type !== 'counter' && family.type !== 'histogram') return [];
				return flattenFamily(family).map(
					(series) =>
						new OrchardMintMetricsSnapshot(
							series.name,
							series.labels,
							series.type as MintMetricType,
							series.value,
							series.sum,
							series.count,
						),
				);
			});
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintMetricsError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Throws when the mint backend has no prometheus metrics support or no endpoint is configured
	 */
	private async guardSupport(): Promise<void> {
		if (this.configService.get('cashu.type') !== MintType.CDK) throw OrchardErrorCode.MintSupportError;
		if (!(await this.settingService.getStringSetting(SettingKey.MINT_METRICS_API))) throw OrchardErrorCode.MintSupportError;
	}

	/* *******************************************************
		Aggregation
	******************************************************** */

	/**
	 * Aggregates raw cumulative rows into interval data points per series
	 */
	private aggregateByInterval(data: MintMetrics[], interval: SystemMetricsInterval, timezone?: string): OrchardMintMetrics[] {
		const tz = timezone ?? 'UTC';
		const series_map = new Map<string, MintMetrics[]>();

		for (const row of data) {
			const key = `${row.metric}|${row.labels}`;
			const series = series_map.get(key);
			if (series) series.push(row);
			else series_map.set(key, [row]);
		}

		const out: OrchardMintMetrics[] = [];
		for (const series of series_map.values()) {
			const type = series[0].type as MintMetricType;
			if (type === MintMetricType.gauge) out.push(...this.aggregateGaugeSeries(series, interval, tz));
			if (type === MintMetricType.counter) out.push(...this.aggregateCounterSeries(series, interval, tz));
			if (type === MintMetricType.histogram) out.push(...this.aggregateHistogramSeries(series, interval, tz));
		}

		return out.sort((a, b) => a.date - b.date || a.metric.localeCompare(b.metric));
	}

	/**
	 * Aggregates a gauge series into avg/min/max per interval bucket
	 */
	private aggregateGaugeSeries(series: MintMetrics[], interval: SystemMetricsInterval, tz: string): OrchardMintMetrics[] {
		type Bucket = {values: number[]; min: number; max: number};
		const buckets = new Map<number, Bucket>();

		for (const row of series) {
			if (row.value === null) continue;
			const bucket_date = this.getBucketDate(row.date, interval, tz);
			const bucket = buckets.get(bucket_date);
			if (bucket) {
				bucket.values.push(row.value);
				bucket.min = Math.min(bucket.min, row.value);
				bucket.max = Math.max(bucket.max, row.value);
			} else {
				buckets.set(bucket_date, {values: [row.value], min: row.value, max: row.value});
			}
		}

		return Array.from(buckets.entries()).map(([date, bucket]) => {
			const avg = bucket.values.reduce((sum, v) => sum + v, 0) / bucket.values.length;
			return new OrchardMintMetrics(series[0].metric, series[0].labels, MintMetricType.gauge, date, avg, {
				min: bucket.min,
				max: bucket.max,
			});
		});
	}

	/**
	 * Aggregates a cumulative counter series into per-interval deltas
	 * A drop in the cumulative value means the mint restarted; the new value is the delta
	 */
	private aggregateCounterSeries(series: MintMetrics[], interval: SystemMetricsInterval, tz: string): OrchardMintMetrics[] {
		const buckets = new Map<number, number>();

		for (let i = 1; i < series.length; i++) {
			const previous = series[i - 1].value;
			const current = series[i].value;
			if (previous === null || current === null) continue;
			const delta = current >= previous ? current - previous : current;
			const bucket_date = this.getBucketDate(series[i].date, interval, tz);
			buckets.set(bucket_date, (buckets.get(bucket_date) ?? 0) + delta);
		}

		return Array.from(buckets.entries()).map(
			([date, delta]) => new OrchardMintMetrics(series[0].metric, series[0].labels, MintMetricType.counter, date, delta),
		);
	}

	/**
	 * Aggregates a cumulative histogram series into per-interval average durations
	 * Value is null for intervals without observations
	 */
	private aggregateHistogramSeries(series: MintMetrics[], interval: SystemMetricsInterval, tz: string): OrchardMintMetrics[] {
		type Bucket = {sum: number; count: number};
		const buckets = new Map<number, Bucket>();

		for (let i = 1; i < series.length; i++) {
			const previous = series[i - 1];
			const current = series[i];
			if (previous.sum === null || current.sum === null || previous.count === null || current.count === null) continue;
			const reset = current.count < previous.count;
			const delta_sum = reset ? current.sum : current.sum - previous.sum;
			const delta_count = reset ? current.count : current.count - previous.count;
			const bucket_date = this.getBucketDate(current.date, interval, tz);
			const bucket = buckets.get(bucket_date) ?? {sum: 0, count: 0};
			bucket.sum += delta_sum;
			bucket.count += delta_count;
			buckets.set(bucket_date, bucket);
		}

		return Array.from(buckets.entries()).map(
			([date, bucket]) =>
				new OrchardMintMetrics(
					series[0].metric,
					series[0].labels,
					MintMetricType.histogram,
					date,
					bucket.count > 0 ? bucket.sum / bucket.count : null,
					{count: bucket.count},
				),
		);
	}

	/**
	 * Gets the bucket start timestamp for a given interval
	 */
	private getBucketDate(date: number, interval: SystemMetricsInterval, timezone: string): number {
		const dt = DateTime.fromSeconds(date, {zone: timezone});

		switch (interval) {
			case SystemMetricsInterval.day:
				return dt.startOf('day').toUnixInteger();
			case SystemMetricsInterval.hour:
				return dt.startOf('hour').toUnixInteger();
			default:
				return dt.startOf('minute').toUnixInteger();
		}
	}
}
