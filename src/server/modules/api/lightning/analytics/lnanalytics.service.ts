/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
import {LightningAnalyticsService} from '@server/modules/lightning/analytics/lnanalytics.service';
import {LightningAnalytics} from '@server/modules/lightning/analytics/lnanalytics.entity';
import {LightningAnalyticsMetric} from '@server/modules/lightning/analytics/lnanalytics.enums';
import {AnalyticsInterval} from '@server/modules/analytics/analytics.enums';
import {getBucketDate} from '@server/modules/analytics/analytics.helpers';
import {OrchardAnalyticsBackfillStatus} from '@server/modules/api/common/analytics-backfill-status.model';
/* Local Dependencies */
import {OrchardLightningAnalytics, OrchardLightningAnalyticsMetric} from './lnanalytics.model.js';
import {LightningAnalyticsApiArgs, LightningAnalyticsMetricsArgs} from './lnanalytics.interfaces.js';

@Injectable()
export class ApiLightningAnalyticsService {
	private readonly logger = new Logger(ApiLightningAnalyticsService.name);

	constructor(
		private lightningAnalyticsService: LightningAnalyticsService,
		private errorService: ErrorService,
	) {}

	/* *******************************************************
		Analytics Queries
	******************************************************** */

	/** Gets local balance analytics (channel_opens + invoices_in + forward_fees - payments_out - channel_closes) */
	async getAnalyticsLocalBalance(tag: string, args: LightningAnalyticsApiArgs): Promise<OrchardLightningAnalytics[]> {
		return this.getNetBalance(tag, args, {
			positive: [LightningAnalyticsMetric.channel_opens, LightningAnalyticsMetric.invoices_in, LightningAnalyticsMetric.forward_fees],
			negative: [LightningAnalyticsMetric.payments_out, LightningAnalyticsMetric.channel_closes],
		});
	}

	/** Gets remote balance analytics (channel_opens_remote + payments_out - invoices_in - forward_fees - channel_closes_remote) */
	async getAnalyticsRemoteBalance(tag: string, args: LightningAnalyticsApiArgs): Promise<OrchardLightningAnalytics[]> {
		return this.getNetBalance(tag, args, {
			positive: [LightningAnalyticsMetric.channel_opens_remote, LightningAnalyticsMetric.payments_out],
			negative: [
				LightningAnalyticsMetric.invoices_in,
				LightningAnalyticsMetric.forward_fees,
				LightningAnalyticsMetric.channel_closes_remote,
			],
		});
	}

	/** Computes net balance from positive and negative metric groups */
	private async getNetBalance(
		tag: string,
		args: LightningAnalyticsApiArgs,
		metrics: {positive: LightningAnalyticsMetric[]; negative: LightningAnalyticsMetric[]},
	): Promise<OrchardLightningAnalytics[]> {
		try {
			const {interval, date_start, cached_end} = this.resolveQueryParams(args);
			const all_metrics = [...metrics.positive, ...metrics.negative];
			const cached = await this.lightningAnalyticsService.getCachedAnalytics(date_start, cached_end, all_metrics);
			const non_zero = cached.filter((d) => d.amount !== '0');

			const positive_set = new Set(metrics.positive as string[]);
			const positive = non_zero.filter((d) => positive_set.has(d.metric));
			const negative = non_zero.filter((d) => !positive_set.has(d.metric));
			const agg_positive = this.aggregateByIntervalSimple(positive, interval, args.timezone, date_start);
			const agg_negative = this.aggregateByIntervalSimple(negative, interval, args.timezone, date_start);

			const positive_map = new Map<string, bigint>();
			for (const p of agg_positive) {
				const key = `${p.unit}:${p.date}`;
				positive_map.set(key, (positive_map.get(key) ?? BigInt(0)) + BigInt(p.amount));
			}
			const negative_map = new Map<string, bigint>();
			for (const n of agg_negative) {
				const key = `${n.unit}:${n.date}`;
				negative_map.set(key, (negative_map.get(key) ?? BigInt(0)) + BigInt(n.amount));
			}

			const all_keys = new Set([...Array.from(positive_map.keys()), ...Array.from(negative_map.keys())]);
			return Array.from(all_keys)
				.map((key) => {
					const pos = positive_map.get(key) ?? BigInt(0);
					const neg = negative_map.get(key) ?? BigInt(0);
					const net = pos - neg;
					const [unit, date_str] = key.split(':');
					return new OrchardLightningAnalytics(unit, net.toString(), Number(date_str));
				})
				.filter((d) => d.amount !== '0')
				.sort((a, b) => a.date - b.date);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** Gets per-metric analytics (payments, invoices, forwards, channel events) */
	async getAnalyticsMetrics(tag: string, args: LightningAnalyticsMetricsArgs): Promise<OrchardLightningAnalyticsMetric[]> {
		try {
			const {interval, date_start, cached_end} = this.resolveQueryParams(args);
			const metrics = args.metrics ?? Object.values(LightningAnalyticsMetric);
			const cached = await this.lightningAnalyticsService.getCachedAnalytics(date_start, cached_end, metrics);
			const all_data = cached.filter((d) => d.amount !== '0');
			return this.aggregateByIntervalWithMetric(all_data, interval, args.timezone, date_start);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/* *******************************************************
		Backfill Status
	******************************************************** */

	/** Gets the current backfill status */
	getBackfillStatus(tag: string): OrchardAnalyticsBackfillStatus {
		try {
			const status = this.lightningAnalyticsService.getBackfillStatus();
			return new OrchardAnalyticsBackfillStatus(status);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/* *******************************************************
		Helpers
	******************************************************** */

	/** Resolves common query parameters with defaults */
	private resolveQueryParams(args: LightningAnalyticsApiArgs) {
		const now = DateTime.utc().toUnixInteger();
		const current_hour_start = DateTime.fromSeconds(now, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		return {
			interval: args.interval ?? AnalyticsInterval.hour,
			date_start: args.date_start ?? 0,
			cached_end: Math.min(args.date_end ?? now, current_hour_start - 1),
		};
	}

	/** Aggregates hourly data by interval, ignoring metric dimension. Returns simple type. */
	private aggregateByIntervalSimple(
		data: LightningAnalytics[],
		interval: AnalyticsInterval,
		timezone?: string,
		date_start?: number,
	): OrchardLightningAnalytics[] {
		if (interval === AnalyticsInterval.hour) {
			return data.map((d) => new OrchardLightningAnalytics(d.unit, d.amount, d.date));
		}

		const tz = timezone ?? 'UTC';
		type Bucket = {unit: string; amount: bigint; date: number};

		const buckets = data.reduce((acc, d) => {
			const bucket_date = getBucketDate(d.date, interval, tz, date_start, data);
			const key = interval === AnalyticsInterval.custom ? d.unit : `${d.unit}:${bucket_date}`;
			const existing = acc.get(key);

			if (existing) {
				existing.amount += BigInt(d.amount);
			} else {
				acc.set(key, {unit: d.unit, amount: BigInt(d.amount), date: bucket_date});
			}
			return acc;
		}, new Map<string, Bucket>());

		return Array.from(buckets.values())
			.sort((a, b) => a.date - b.date)
			.map((b) => new OrchardLightningAnalytics(b.unit, b.amount.toString(), b.date));
	}

	/** Aggregates hourly data by interval, preserving metric dimension. Returns detailed type. */
	private aggregateByIntervalWithMetric(
		data: LightningAnalytics[],
		interval: AnalyticsInterval,
		timezone?: string,
		date_start?: number,
	): OrchardLightningAnalyticsMetric[] {
		if (interval === AnalyticsInterval.hour) {
			return data.map(
				(d) => new OrchardLightningAnalyticsMetric(d.unit, d.metric as LightningAnalyticsMetric, d.amount, d.date, d.count),
			);
		}

		const tz = timezone ?? 'UTC';
		type Bucket = {unit: string; metric: LightningAnalyticsMetric; amount: bigint; date: number; count: number};

		const buckets = data.reduce((acc, d) => {
			const bucket_date = getBucketDate(d.date, interval, tz, date_start, data);
			const key = interval === AnalyticsInterval.custom ? `${d.unit}:${d.metric}` : `${d.unit}:${d.metric}:${bucket_date}`;
			const existing = acc.get(key);

			if (existing) {
				existing.amount += BigInt(d.amount);
				existing.count += d.count;
			} else {
				acc.set(key, {
					unit: d.unit,
					metric: d.metric as LightningAnalyticsMetric,
					amount: BigInt(d.amount),
					date: bucket_date,
					count: d.count,
				});
			}
			return acc;
		}, new Map<string, Bucket>());

		return Array.from(buckets.values())
			.sort((a, b) => a.date - b.date)
			.map((b) => new OrchardLightningAnalyticsMetric(b.unit, b.metric, b.amount.toString(), b.date, b.count));
	}

	/** Wraps errors in OrchardApiError */
	private handleError(tag: string, error: unknown): OrchardApiError {
		const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
			errord: OrchardErrorCode.LightningAnalyticsError,
		});
		return new OrchardApiError(orchard_error);
	}
}
