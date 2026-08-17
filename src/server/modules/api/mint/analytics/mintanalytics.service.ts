/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {CashuMintAnalyticsService} from '#server/modules/cashu/mintanalytics/mintanalytics.service';
import {MintAnalytics} from '#server/modules/cashu/mintanalytics/mintanalytics.entity';
import {MintAnalyticsMetric} from '#server/modules/cashu/mintanalytics/mintanalytics.enums';
import {AnalyticsInterval} from '#server/modules/analytics/analytics.enums';
import {getBucketDate} from '#server/modules/analytics/analytics.helpers';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardAnalyticsBackfillStatus} from '#server/modules/api/common/analytics-backfill-status.model';
/* Local Dependencies */
import {OrchardMintAnalytics, OrchardMintAnalyticsMetric, OrchardMintKeysetsAnalytics} from './mintanalytics.model.js';
import type {MintAnalyticsApiArgs, MintAnalyticsMetricsArgs} from './mintanalytics.interfaces.js';

@Injectable()
export class MintAnalyticsService {
	private readonly logger = new Logger(MintAnalyticsService.name);

	constructor(
		private cashuMintAnalyticsService: CashuMintAnalyticsService,
		private errorService: ErrorService,
	) {}

	/* *******************************************************
		Analytics Queries
	******************************************************** */

	/** Gets balance analytics (issued - redeemed per unit per bucket) */
	async getMintAnalyticsBalances(tag: string, args: MintAnalyticsApiArgs): Promise<OrchardMintAnalytics[]> {
		try {
			const {interval, date_start, cached_end} = this.resolveQueryParams(args);
			const cached = await this.cashuMintAnalyticsService.getCachedAnalytics({
				date_start,
				date_end: cached_end,
				metrics: [MintAnalyticsMetric.issued_amount, MintAnalyticsMetric.redeemed_amount],
				units: args.units?.map((u) => String(u)),
			});
			const non_zero = cached.filter((d) => d.amount !== '0');
			const issued = non_zero.filter((d) => d.metric === MintAnalyticsMetric.issued_amount);
			const redeemed = non_zero.filter((d) => d.metric === MintAnalyticsMetric.redeemed_amount);
			const agg_issued = this.aggregateByInterval(issued, interval, args.timezone, date_start);
			const agg_redeemed = this.aggregateByInterval(redeemed, interval, args.timezone, date_start);

			const issued_map = new Map<string, bigint>();
			for (const i of agg_issued) {
				const key = `${i.unit}:${i.date}`;
				issued_map.set(key, (issued_map.get(key) ?? BigInt(0)) + BigInt(i.amount));
			}
			const redeemed_map = new Map<string, bigint>();
			for (const r of agg_redeemed) {
				const key = `${r.unit}:${r.date}`;
				redeemed_map.set(key, (redeemed_map.get(key) ?? BigInt(0)) + BigInt(r.amount));
			}

			const all_keys = new Set([...Array.from(issued_map.keys()), ...Array.from(redeemed_map.keys())]);
			return Array.from(all_keys)
				.map((key) => {
					const iss = issued_map.get(key) ?? BigInt(0);
					const red = redeemed_map.get(key) ?? BigInt(0);
					const balance = iss - red;
					const [unit, date_str] = key.split(':');
					return new OrchardMintAnalytics(unit, balance.toString(), Number(date_str));
				})
				.filter((d) => d.amount !== '0')
				.sort((a, b) => a.date - b.date);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** Gets mint quote analytics */
	async getMintAnalyticsMints(tag: string, args: MintAnalyticsApiArgs): Promise<OrchardMintAnalytics[]> {
		return this.getMetricAnalytics(tag, args, [MintAnalyticsMetric.mints_amount]);
	}

	/** Gets melt quote analytics */
	async getMintAnalyticsMelts(tag: string, args: MintAnalyticsApiArgs): Promise<OrchardMintAnalytics[]> {
		return this.getMetricAnalytics(tag, args, [MintAnalyticsMetric.melts_amount]);
	}

	/** Gets swap analytics */
	async getMintAnalyticsSwaps(tag: string, args: MintAnalyticsApiArgs): Promise<OrchardMintAnalytics[]> {
		return this.getMetricAnalytics(tag, args, [MintAnalyticsMetric.swaps_amount]);
	}

	/** Gets fee analytics */
	async getMintAnalyticsFees(tag: string, args: MintAnalyticsApiArgs): Promise<OrchardMintAnalytics[]> {
		return this.getMetricAnalytics(tag, args, [MintAnalyticsMetric.fees_amount]);
	}

	/** Gets proof (redeemed) count analytics */
	async getMintAnalyticsProofs(tag: string, args: MintAnalyticsApiArgs): Promise<OrchardMintAnalytics[]> {
		return this.getMetricAnalytics(tag, args, [MintAnalyticsMetric.redeemed_amount], true);
	}

	/** Gets promise (issued) count analytics */
	async getMintAnalyticsPromises(tag: string, args: MintAnalyticsApiArgs): Promise<OrchardMintAnalytics[]> {
		return this.getMetricAnalytics(tag, args, [MintAnalyticsMetric.issued_amount], true);
	}

	/** Gets per-metric analytics with optional metric filtering */
	async getAnalyticsMetrics(tag: string, args: MintAnalyticsMetricsArgs): Promise<OrchardMintAnalyticsMetric[]> {
		try {
			const {interval, date_start, cached_end} = this.resolveQueryParams(args);
			const default_metrics = Object.values(MintAnalyticsMetric).filter(
				(m) => m !== MintAnalyticsMetric.keyset_issued && m !== MintAnalyticsMetric.keyset_redeemed,
			);
			const metrics = args.metrics ?? default_metrics;
			const cached = await this.cashuMintAnalyticsService.getCachedAnalytics({
				date_start,
				date_end: cached_end,
				metrics,
				units: args.units?.map((u) => String(u)),
			});
			const filtered = cached.filter((d) => d.amount !== '0');
			return this.aggregateByIntervalWithMetric(filtered, interval, args.timezone, date_start);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** Gets keyset-level analytics (issued − redeemed per keyset per bucket) */
	async getMintAnalyticsKeysets(tag: string, args: MintAnalyticsApiArgs): Promise<OrchardMintKeysetsAnalytics[]> {
		try {
			const {interval, date_start, cached_end} = this.resolveQueryParams(args);
			const cached = await this.cashuMintAnalyticsService.getCachedAnalytics({
				date_start,
				date_end: cached_end,
				metrics: [MintAnalyticsMetric.keyset_issued, MintAnalyticsMetric.keyset_redeemed],
			});
			const keyset_data = cached.filter((d) => d.keyset_id !== '' && d.amount !== '0');
			const issued = keyset_data.filter((d) => d.metric === MintAnalyticsMetric.keyset_issued);
			const redeemed = keyset_data.filter((d) => d.metric === MintAnalyticsMetric.keyset_redeemed);
			const issued_map = this.aggregateKeysetsForMetric(issued, interval, args.timezone, date_start);
			const redeemed_map = this.aggregateKeysetsForMetric(redeemed, interval, args.timezone, date_start);

			const all_keys = new Set([...Array.from(issued_map.keys()), ...Array.from(redeemed_map.keys())]);
			return Array.from(all_keys)
				.map((key) => {
					const iss = issued_map.get(key) ?? {amount: BigInt(0), keyset_id: '', date: 0};
					const red = redeemed_map.get(key) ?? {amount: BigInt(0), keyset_id: '', date: 0};
					const ref = issued_map.get(key) ?? redeemed_map.get(key)!;
					return new OrchardMintKeysetsAnalytics(ref.keyset_id, (iss.amount - red.amount).toString(), ref.date);
				})
				.filter((d) => d.amount !== '0')
				.sort((a, b) => a.date - b.date);
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
			const status = this.cashuMintAnalyticsService.getBackfillStatus();
			return new OrchardAnalyticsBackfillStatus(status);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/* *******************************************************
		Helpers
	******************************************************** */

	/** Fetches cached data for specific metrics, filters zeros, aggregates by interval */
	private async getMetricAnalytics(
		tag: string,
		args: MintAnalyticsApiArgs,
		metrics: MintAnalyticsMetric[],
		include_count?: boolean,
	): Promise<OrchardMintAnalytics[]> {
		try {
			const {interval, date_start, cached_end} = this.resolveQueryParams(args);
			const cached = await this.cashuMintAnalyticsService.getCachedAnalytics({
				date_start,
				date_end: cached_end,
				metrics,
				units: args.units?.map((u) => String(u)),
			});
			const filtered = cached.filter((d) => d.amount !== '0');
			return this.aggregateByInterval(filtered, interval, args.timezone, date_start, include_count);
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** Resolves common query parameters with defaults */
	private resolveQueryParams(args: MintAnalyticsApiArgs) {
		const now = DateTime.utc().toUnixInteger();
		const current_hour_start = DateTime.fromSeconds(now, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		return {
			interval: args.interval ?? AnalyticsInterval.hour,
			date_start: args.date_start ?? 0,
			cached_end: Math.min(args.date_end ?? now, current_hour_start - 1),
		};
	}

	/** Aggregates hourly cache data into the requested interval */
	private aggregateByInterval(
		data: MintAnalytics[],
		interval: AnalyticsInterval,
		timezone?: string,
		date_start?: number,
		include_count?: boolean,
	): OrchardMintAnalytics[] {
		if (interval === AnalyticsInterval.hour) {
			return data.map((d) => new OrchardMintAnalytics(d.unit, d.amount, d.date, include_count ? d.count : undefined));
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
			.map((b) => new OrchardMintAnalytics(b.unit, b.amount.toString(), b.date, include_count ? b.count : undefined));
	}

	/** Aggregates hourly data by interval, preserving metric dimension */
	private aggregateByIntervalWithMetric(
		data: MintAnalytics[],
		interval: AnalyticsInterval,
		timezone?: string,
		date_start?: number,
	): OrchardMintAnalyticsMetric[] {
		if (interval === AnalyticsInterval.hour) {
			return data.map((d) => new OrchardMintAnalyticsMetric(d.unit, d.metric as MintAnalyticsMetric, d.amount, d.date, d.count));
		}

		const tz = timezone ?? 'UTC';
		type Bucket = {unit: string; metric: MintAnalyticsMetric; amount: bigint; date: number; count: number};

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
					metric: d.metric as MintAnalyticsMetric,
					amount: BigInt(d.amount),
					date: bucket_date,
					count: d.count,
				});
			}
			return acc;
		}, new Map<string, Bucket>());

		return Array.from(buckets.values())
			.sort((a, b) => a.date - b.date)
			.map((b) => new OrchardMintAnalyticsMetric(b.unit, b.metric, b.amount.toString(), b.date, b.count));
	}

	/** Aggregates same-metric keyset rows into a {keyset_id:bucket_date → bucket} map */
	private aggregateKeysetsForMetric(
		data: MintAnalytics[],
		interval: AnalyticsInterval,
		timezone?: string,
		date_start?: number,
	): Map<string, {keyset_id: string; amount: bigint; date: number}> {
		const tz = timezone ?? 'UTC';
		type Bucket = {keyset_id: string; amount: bigint; date: number};

		return data.reduce((acc, d) => {
			let bucket_date: number;
			if (interval === AnalyticsInterval.hour) bucket_date = d.date;
			else if (interval === AnalyticsInterval.custom) bucket_date = date_start ?? 0;
			else bucket_date = getBucketDate(d.date, interval, tz, date_start, data);
			const key = interval === AnalyticsInterval.custom ? d.keyset_id : `${d.keyset_id}:${bucket_date}`;
			const existing = acc.get(key);

			if (existing) {
				existing.amount += BigInt(d.amount);
			} else {
				acc.set(key, {keyset_id: d.keyset_id, amount: BigInt(d.amount), date: bucket_date});
			}
			return acc;
		}, new Map<string, Bucket>());
	}

	/** Wraps errors in OrchardApiError */
	private handleError(tag: string, error: unknown): OrchardApiError {
		const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
			errord: OrchardErrorCode.MintAnalyticsError,
		});
		return new OrchardApiError(orchard_error);
	}
}
