/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
import {BitcoinAnalyticsService} from '@server/modules/bitcoin/analytics/btcanalytics.service';
import {BitcoinAnalytics} from '@server/modules/bitcoin/analytics/btcanalytics.entity';
import {BitcoinAnalyticsMetric} from '@server/modules/bitcoin/analytics/btcanalytics.enums';
import {AnalyticsInterval} from '@server/modules/analytics/analytics.enums';
import {getBucketDate} from '@server/modules/analytics/analytics.helpers';
import {OrchardAnalyticsBackfillStatus} from '@server/modules/api/common/analytics-backfill-status.model';
/* Local Dependencies */
import {OrchardBitcoinAnalytics, OrchardBitcoinAnalyticsMetric} from './btcanalytics.model.js';
import {BitcoinAnalyticsApiArgs, BitcoinAnalyticsMetricsArgs} from './btcanalytics.interfaces.js';

@Injectable()
export class ApiBitcoinAnalyticsService {
	private readonly logger = new Logger(ApiBitcoinAnalyticsService.name);

	constructor(
		private bitcoinAnalyticsService: BitcoinAnalyticsService,
		private errorService: ErrorService,
	) {}

	/* *******************************************************
		Analytics Queries
	******************************************************** */

	/**
	 * Gets net wallet balance change over time (payments_in - payments_out - fees)
	 */
	async getAnalyticsBalance(tag: string, args: BitcoinAnalyticsApiArgs): Promise<OrchardBitcoinAnalytics[]> {
		try {
			const {interval, date_start, cached_end} = this.resolveQueryParams(args);
			const all_metrics = [BitcoinAnalyticsMetric.payments_in, BitcoinAnalyticsMetric.payments_out, BitcoinAnalyticsMetric.fees];
			const cached = await this.bitcoinAnalyticsService.getCachedAnalytics(date_start, cached_end, all_metrics);
			const non_zero = cached.filter((d) => d.amount !== '0');

			const positive = non_zero.filter((d) => d.metric === BitcoinAnalyticsMetric.payments_in);
			const negative = non_zero.filter((d) => d.metric !== BitcoinAnalyticsMetric.payments_in);
			const agg_positive = this.aggregateByIntervalSimple(positive, interval, args.timezone, date_start);
			const agg_negative = this.aggregateByIntervalSimple(negative, interval, args.timezone, date_start);

			type BalanceBucket = {amount: bigint; count: number};
			const positive_map = new Map<string, BalanceBucket>();
			for (const p of agg_positive) {
				positive_map.set(`${p.unit}:${p.date}`, {amount: BigInt(p.amount), count: p.count ?? 0});
			}
			const negative_map = new Map<string, BalanceBucket>();
			for (const n of agg_negative) {
				const key = `${n.unit}:${n.date}`;
				const existing = negative_map.get(key);
				negative_map.set(key, {
					amount: (existing?.amount ?? BigInt(0)) + BigInt(n.amount),
					count: (existing?.count ?? 0) + (n.count ?? 0),
				});
			}

			const all_keys = new Set([...Array.from(positive_map.keys()), ...Array.from(negative_map.keys())]);
			return Array.from(all_keys)
				.map((key) => {
					const pos = positive_map.get(key) ?? {amount: BigInt(0), count: 0};
					const neg = negative_map.get(key) ?? {amount: BigInt(0), count: 0};
					const net = pos.amount - neg.amount;
					const total_count = pos.count + neg.count;
					const [unit, date_str] = key.split(':');
					return new OrchardBitcoinAnalytics(unit, net.toString(), Number(date_str), total_count);
				})
				.filter((d) => d.amount !== '0')
				.sort((a, b) => a.date - b.date);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/**
	 * Gets per-metric analytics (payments_in, payments_out, fees)
	 */
	async getAnalyticsMetrics(tag: string, args: BitcoinAnalyticsMetricsArgs): Promise<OrchardBitcoinAnalyticsMetric[]> {
		try {
			const {interval, date_start, cached_end} = this.resolveQueryParams(args);
			const metrics = args.metrics ?? Object.values(BitcoinAnalyticsMetric);
			const cached = await this.bitcoinAnalyticsService.getCachedAnalytics(date_start, cached_end, metrics);
			const all_data = cached.filter((d) => d.amount !== '0');
			return this.aggregateByIntervalWithMetric(all_data, interval, args.timezone, date_start);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/* *******************************************************
		Backfill Status
	******************************************************** */

	/**
	 * Gets the current backfill status
	 */
	getBackfillStatus(tag: string): OrchardAnalyticsBackfillStatus {
		try {
			const status = this.bitcoinAnalyticsService.getBackfillStatus();
			return new OrchardAnalyticsBackfillStatus(status);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/* *******************************************************
		Helpers
	******************************************************** */

	/**
	 * Resolves common query parameters with defaults
	 */
	private resolveQueryParams(args: BitcoinAnalyticsApiArgs) {
		const now = DateTime.utc().toUnixInteger();
		const current_hour_start = DateTime.fromSeconds(now, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		return {
			interval: args.interval ?? AnalyticsInterval.hour,
			date_start: args.date_start ?? 0,
			cached_end: Math.min(args.date_end ?? now, current_hour_start - 1),
		};
	}

	/**
	 * Aggregates hourly data by interval, ignoring metric dimension
	 */
	private aggregateByIntervalSimple(
		data: BitcoinAnalytics[],
		interval: AnalyticsInterval,
		timezone?: string,
		date_start?: number,
	): OrchardBitcoinAnalytics[] {
		if (interval === AnalyticsInterval.hour) {
			return data.map((d) => new OrchardBitcoinAnalytics(d.unit, d.amount, d.date, d.count));
		}

		const tz = timezone ?? 'UTC';
		type Bucket = {unit: string; amount: bigint; date: number; count: number};

		const buckets = data.reduce((acc, d) => {
			const bucket_date = getBucketDate(d.date, interval, tz, date_start, data);
			const key = interval === AnalyticsInterval.custom ? d.unit : `${d.unit}:${bucket_date}`;
			const existing = acc.get(key);

			if (existing) {
				existing.amount += BigInt(d.amount);
				existing.count += d.count;
			} else {
				acc.set(key, {unit: d.unit, amount: BigInt(d.amount), date: bucket_date, count: d.count});
			}
			return acc;
		}, new Map<string, Bucket>());

		return Array.from(buckets.values())
			.sort((a, b) => a.date - b.date)
			.map((b) => new OrchardBitcoinAnalytics(b.unit, b.amount.toString(), b.date, b.count));
	}

	/**
	 * Aggregates hourly data by interval, preserving metric dimension
	 */
	private aggregateByIntervalWithMetric(
		data: BitcoinAnalytics[],
		interval: AnalyticsInterval,
		timezone?: string,
		date_start?: number,
	): OrchardBitcoinAnalyticsMetric[] {
		if (interval === AnalyticsInterval.hour) {
			return data.map(
				(d) => new OrchardBitcoinAnalyticsMetric(d.unit, d.metric as BitcoinAnalyticsMetric, d.amount, d.date, d.count),
			);
		}

		const tz = timezone ?? 'UTC';
		type Bucket = {unit: string; metric: BitcoinAnalyticsMetric; amount: bigint; date: number; count: number};

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
					metric: d.metric as BitcoinAnalyticsMetric,
					amount: BigInt(d.amount),
					date: bucket_date,
					count: d.count,
				});
			}
			return acc;
		}, new Map<string, Bucket>());

		return Array.from(buckets.values())
			.sort((a, b) => a.date - b.date)
			.map((b) => new OrchardBitcoinAnalyticsMetric(b.unit, b.metric, b.amount.toString(), b.date, b.count));
	}

	/**
	 * Wraps errors in OrchardApiError
	 */
	private handleError(tag: string, error: unknown): OrchardApiError {
		const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
			errord: OrchardErrorCode.BitcoinAnalyticsError,
		});
		return new OrchardApiError(orchard_error);
	}
}
