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
import {MintMetricsService} from '@server/modules/cashu/mintmetrics/mintmetrics.service';
import {MintMetrics} from '@server/modules/cashu/mintmetrics/mintmetrics.entity';
import {MintMetricType} from '@server/modules/cashu/mintmetrics/mintmetrics.enums';
import {SystemMetricsInterval} from '@server/modules/system/metrics/sysmetrics.enums';
import {getBucketDate, bucketMinMaxAvg} from '@server/modules/system/metrics/sysmetrics.helpers';
/* Local Dependencies */
import {OrchardMintMetrics} from './mintmetrics.model';

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
		private errorService: ErrorService,
	) {}

	/**
	 * Gets stored mint server metrics with interval aggregation
	 * Gauges aggregate avg/min/max; counters and histograms aggregate per-interval deltas
	 */
	async getMetrics(tag: string, args: MintMetricsArgs): Promise<OrchardMintMetrics[]> {
		try {
			this.guardSupport();
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
	 * Throws when the mint backend has no prometheus metrics support or no endpoint is configured
	 */
	private guardSupport(): void {
		if (this.configService.get('cashu.type') !== MintType.CDK) throw OrchardErrorCode.MintSupportError;
		if (!this.configService.get('cashu.metrics_api')) throw OrchardErrorCode.MintSupportError;
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
		return bucketMinMaxAvg(series, interval, tz).map(
			(bucket) =>
				new OrchardMintMetrics(series[0].metric, series[0].labels, MintMetricType.gauge, bucket.date, bucket.avg, {
					min: bucket.min,
					max: bucket.max,
				}),
		);
	}

	/**
	 * Aggregates a cumulative counter series into per-interval deltas
	 * A drop in the cumulative value means the mint restarted; the new value is the delta
	 * Each delta is attributed to the interval containing the earlier sample, where the traffic occurred
	 */
	private aggregateCounterSeries(series: MintMetrics[], interval: SystemMetricsInterval, tz: string): OrchardMintMetrics[] {
		const buckets = new Map<number, number>();

		for (let i = 1; i < series.length; i++) {
			const previous = series[i - 1].value;
			const current = series[i].value;
			if (previous === null || current === null) continue;
			const delta = current >= previous ? current - previous : current;
			const bucket_date = getBucketDate(series[i - 1].date, interval, tz);
			buckets.set(bucket_date, (buckets.get(bucket_date) ?? 0) + delta);
		}

		return Array.from(buckets.entries()).map(
			([date, delta]) => new OrchardMintMetrics(series[0].metric, series[0].labels, MintMetricType.counter, date, delta),
		);
	}

	/**
	 * Aggregates a cumulative histogram series into per-interval average durations and p50/p95/p99
	 * Value is null for intervals without observations; percentiles are null when bucket data is absent
	 */
	private aggregateHistogramSeries(series: MintMetrics[], interval: SystemMetricsInterval, tz: string): OrchardMintMetrics[] {
		type Bucket = {sum: number; count: number; le_counts: Map<string, number>; has_buckets: boolean};
		const buckets = new Map<number, Bucket>();

		for (let i = 1; i < series.length; i++) {
			const previous = series[i - 1];
			const current = series[i];
			if (previous.sum === null || current.sum === null || previous.count === null || current.count === null) continue;
			const reset = current.count < previous.count;
			const delta_sum = reset ? current.sum : current.sum - previous.sum;
			const delta_count = reset ? current.count : current.count - previous.count;
			// Attribute the delta to the interval containing the earlier sample, where the observations occurred
			const bucket_date = getBucketDate(previous.date, interval, tz);
			const bucket = buckets.get(bucket_date) ?? {sum: 0, count: 0, le_counts: new Map(), has_buckets: false};
			bucket.sum += delta_sum;
			bucket.count += delta_count;
			this.accumulateBucketDeltas(bucket, previous.buckets, current.buckets, reset);
			buckets.set(bucket_date, bucket);
		}

		return Array.from(buckets.entries()).map(([date, bucket]) => {
			const percentiles = this.computePercentiles(bucket.le_counts, bucket.count, bucket.has_buckets);
			return new OrchardMintMetrics(
				series[0].metric,
				series[0].labels,
				MintMetricType.histogram,
				date,
				bucket.count > 0 ? bucket.sum / bucket.count : null,
				{
					count: bucket.count,
					...percentiles,
				},
			);
		});
	}

	/**
	 * Accumulates per-le observation deltas from consecutive cumulative bucket snapshots into an interval bucket
	 */
	private accumulateBucketDeltas(
		bucket: {le_counts: Map<string, number>; has_buckets: boolean},
		previous_json: string | null,
		current_json: string | null,
		reset: boolean,
	): void {
		const current = this.parseBuckets(current_json);
		if (!current) return;
		const previous = this.parseBuckets(previous_json) ?? {};
		bucket.has_buckets = true;
		for (const le of Object.keys(current)) {
			const delta = reset ? current[le] : current[le] - (previous[le] ?? 0);
			bucket.le_counts.set(le, (bucket.le_counts.get(le) ?? 0) + Math.max(0, delta));
		}
	}

	/**
	 * Computes p50/p95/p99 from accumulated per-le deltas, using the interval observation count as the +Inf total
	 */
	private computePercentiles(
		le_counts: Map<string, number>,
		count: number,
		has_buckets: boolean,
	): {p50: number | null; p95: number | null; p99: number | null} {
		if (!has_buckets || count <= 0) return {p50: null, p95: null, p99: null};
		const cumulative: {le: number; count: number}[] = Array.from(le_counts.entries()).map(([le, le_count]) => ({
			le: Number(le),
			count: le_count,
		}));
		cumulative.push({le: Infinity, count});
		return {
			p50: this.histogramQuantile(0.5, cumulative),
			p95: this.histogramQuantile(0.95, cumulative),
			p99: this.histogramQuantile(0.99, cumulative),
		};
	}

	/**
	 * Parses a stored bucket JSON blob into an {le: count} map, tolerating malformed data
	 */
	private parseBuckets(json: string | null): Record<string, number> | null {
		if (!json) return null;
		try {
			const parsed = JSON.parse(json);
			return parsed && typeof parsed === 'object' ? parsed : null;
		} catch {
			return null;
		}
	}

	/**
	 * Computes a quantile from cumulative histogram buckets using Prometheus-style linear interpolation.
	 * The largest-le bucket's count is treated as the total; ranks in the +Inf bucket clamp to the largest finite le.
	 */
	private histogramQuantile(quantile: number, buckets: {le: number; count: number}[]): number | null {
		if (quantile < 0 || quantile > 1 || buckets.length === 0) return null;

		const sorted = [...buckets].sort((a, b) => a.le - b.le);
		const total = sorted[sorted.length - 1].count;
		if (!(total > 0)) return null;

		const rank = quantile * total;
		let index = sorted.findIndex((entry) => entry.count >= rank);
		if (index < 0) index = sorted.length - 1;

		const target = sorted[index];
		if (index === sorted.length - 1) {
			if (Number.isFinite(target.le)) return target.le;
			return index > 0 && Number.isFinite(sorted[index - 1].le) ? sorted[index - 1].le : null;
		}
		if (index === 0 && target.le <= 0) return target.le;

		const lower_le = index > 0 ? sorted[index - 1].le : 0;
		const lower_count = index > 0 ? sorted[index - 1].count : 0;
		const span = target.count - lower_count;
		if (span <= 0) return lower_le;
		return lower_le + (target.le - lower_le) * ((rank - lower_count) / span);
	}
}
