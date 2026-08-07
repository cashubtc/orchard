/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {CashuMintAnalyticsService} from '@server/modules/cashu/mintanalytics/mintanalytics.service';
import {MintAnalytics} from '@server/modules/cashu/mintanalytics/mintanalytics.entity';
import {MintAnalyticsMetric} from '@server/modules/cashu/mintanalytics/mintanalytics.enums';
import {MintActivityPeriod} from '@server/modules/cashu/mintdb/cashumintdb.enums';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
/* Local Dependencies */
import {OrchardMintActivitySummary, OrchardMintActivityBucket} from './mintactivity.model.js';

/** All metrics needed to compute the activity summary */
const ACTIVITY_METRICS = [
	MintAnalyticsMetric.mints_created,
	MintAnalyticsMetric.mints_amount,
	MintAnalyticsMetric.mints_completion_time,
	MintAnalyticsMetric.melts_created,
	MintAnalyticsMetric.melts_amount,
	MintAnalyticsMetric.melts_completion_time,
	MintAnalyticsMetric.swaps_amount,
];

/** Maps period enum to duration in seconds */
const PERIOD_SECONDS: Record<MintActivityPeriod, number> = {
	[MintActivityPeriod.day]: 86400,
	[MintActivityPeriod.three_day]: 259200,
	[MintActivityPeriod.week]: 604800,
};

/** Maps period enum to sparkline bucket size in seconds */
const BUCKET_SECONDS: Record<MintActivityPeriod, number> = {
	[MintActivityPeriod.day]: 3600,
	[MintActivityPeriod.three_day]: 86400,
	[MintActivityPeriod.week]: 86400,
};

@Injectable()
export class MintActivityService {
	private readonly logger = new Logger(MintActivityService.name);

	constructor(
		private cashuMintAnalyticsService: CashuMintAnalyticsService,
		private errorService: ErrorService,
	) {}

	/**
	 * Fetches cached analytics for two consecutive periods and computes
	 * all activity summary metrics from the pre-aggregated data.
	 */
	public async getMintActivitySummary(tag: string, period: MintActivityPeriod, timezone?: string): Promise<OrchardMintActivitySummary> {
		try {
			const now = Math.floor(Date.now() / 1000);
			const cached_end = DateTime.fromSeconds(now, {zone: 'UTC'}).startOf('hour').toUnixInteger() - 1;
			const period_seconds = PERIOD_SECONDS[period];
			const current_start = now - period_seconds;
			const prior_start = now - period_seconds * 2;

			const [current_rows, prior_rows] = await Promise.all([
				this.cashuMintAnalyticsService.getCachedAnalytics({
					date_start: current_start,
					date_end: cached_end,
					metrics: ACTIVITY_METRICS,
				}),
				this.cashuMintAnalyticsService.getCachedAnalytics({
					date_start: prior_start,
					date_end: current_start - 1,
					metrics: ACTIVITY_METRICS,
				}),
			]);

			return this.buildSummaryFromCache(current_rows, prior_rows, current_start, cached_end, period, timezone || 'UTC');
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintDatabaseSelectError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Builds the full activity summary from current and prior period cache rows */
	private buildSummaryFromCache(
		current: MintAnalytics[],
		prior: MintAnalytics[],
		period_start: number,
		period_end: number,
		period: MintActivityPeriod,
		timezone: string,
	): OrchardMintActivitySummary {
		const cur_mints_created = this.aggregateMetric(current, MintAnalyticsMetric.mints_created);
		const cur_mints_amount = this.aggregateMetric(current, MintAnalyticsMetric.mints_amount);
		const cur_mints_time = this.aggregateMetric(current, MintAnalyticsMetric.mints_completion_time);
		const cur_melts_created = this.aggregateMetric(current, MintAnalyticsMetric.melts_created);
		const cur_melts_amount = this.aggregateMetric(current, MintAnalyticsMetric.melts_amount);
		const cur_melts_time = this.aggregateMetric(current, MintAnalyticsMetric.melts_completion_time);
		const cur_swaps = this.aggregateMetric(current, MintAnalyticsMetric.swaps_amount);

		const pri_mints_created = this.aggregateMetric(prior, MintAnalyticsMetric.mints_created);
		const pri_mints_amount = this.aggregateMetric(prior, MintAnalyticsMetric.mints_amount);
		const pri_mints_time = this.aggregateMetric(prior, MintAnalyticsMetric.mints_completion_time);
		const pri_melts_created = this.aggregateMetric(prior, MintAnalyticsMetric.melts_created);
		const pri_melts_amount = this.aggregateMetric(prior, MintAnalyticsMetric.melts_amount);
		const pri_melts_time = this.aggregateMetric(prior, MintAnalyticsMetric.melts_completion_time);
		const pri_swaps = this.aggregateMetric(prior, MintAnalyticsMetric.swaps_amount);

		const summary = new OrchardMintActivitySummary();

		summary.mint_count = cur_mints_created.count;
		summary.melt_count = cur_melts_created.count;
		summary.swap_count = cur_swaps.count;
		summary.total_operations = summary.mint_count + summary.melt_count + summary.swap_count;

		const cur_volume = cur_mints_amount.amount + cur_melts_amount.amount + cur_swaps.amount;
		const pri_volume = pri_mints_amount.amount + pri_melts_amount.amount + pri_swaps.amount;
		summary.total_volume = cur_volume;

		summary.total_operations_delta = this.computeDelta(
			summary.total_operations,
			pri_mints_created.count + pri_melts_created.count + pri_swaps.count,
		);
		summary.total_volume_delta = this.computeDelta(cur_volume, pri_volume);
		summary.mint_count_delta = this.computeDelta(cur_mints_created.count, pri_mints_created.count);
		summary.melt_count_delta = this.computeDelta(cur_melts_created.count, pri_melts_created.count);
		summary.swap_count_delta = this.computeDelta(cur_swaps.count, pri_swaps.count);

		summary.mint_completed_pct = cur_mints_created.count > 0 ? (cur_mints_amount.count / cur_mints_created.count) * 100 : 0;
		summary.melt_completed_pct = cur_melts_created.count > 0 ? (cur_melts_amount.count / cur_melts_created.count) * 100 : 0;
		const pri_mint_pct = pri_mints_created.count > 0 ? (pri_mints_amount.count / pri_mints_created.count) * 100 : 0;
		const pri_melt_pct = pri_melts_created.count > 0 ? (pri_melts_amount.count / pri_melts_created.count) * 100 : 0;
		summary.mint_completed_pct_delta = this.computeDelta(summary.mint_completed_pct, pri_mint_pct);
		summary.melt_completed_pct_delta = this.computeDelta(summary.melt_completed_pct, pri_melt_pct);

		summary.mint_avg_time = cur_mints_time.count > 0 ? cur_mints_time.amount / cur_mints_time.count : 0;
		summary.melt_avg_time = cur_melts_time.count > 0 ? cur_melts_time.amount / cur_melts_time.count : 0;
		const pri_mint_avg = pri_mints_time.count > 0 ? pri_mints_time.amount / pri_mints_time.count : 0;
		const pri_melt_avg = pri_melts_time.count > 0 ? pri_melts_time.amount / pri_melts_time.count : 0;
		summary.mint_avg_time_delta = this.computeDelta(summary.mint_avg_time, pri_mint_avg);
		summary.melt_avg_time_delta = this.computeDelta(summary.melt_avg_time, pri_melt_avg);

		const bucket_seconds = BUCKET_SECONDS[period];
		summary.mint_sparkline = this.buildCacheSparkline(
			current,
			MintAnalyticsMetric.mints_amount,
			period_start,
			period_end,
			bucket_seconds,
			timezone,
		);
		summary.melt_sparkline = this.buildCacheSparkline(
			current,
			MintAnalyticsMetric.melts_amount,
			period_start,
			period_end,
			bucket_seconds,
			timezone,
		);
		summary.swap_sparkline = this.buildCacheSparkline(
			current,
			MintAnalyticsMetric.swaps_amount,
			period_start,
			period_end,
			bucket_seconds,
			timezone,
		);

		summary.warnings = [];
		const backfill = this.cashuMintAnalyticsService.getBackfillStatus();
		if (backfill.is_running) {
			const date_label = backfill.last_processed_at
				? DateTime.fromSeconds(backfill.last_processed_at, {zone: timezone}).toFormat('MMM d, yyyy')
				: null;
			const suffix = date_label ? ` Currently processing: ${date_label}.` : '';
			summary.warnings.push(`Mint analytics are still being archived. ${suffix}`);
		}

		return summary;
	}

	/** Sums count and amount across all units for a given metric */
	private aggregateMetric(rows: MintAnalytics[], metric: MintAnalyticsMetric): {count: number; amount: number} {
		let count = 0;
		let amount = BigInt(0);
		for (const row of rows) {
			if (row.metric !== metric) continue;
			count += row.count;
			amount += BigInt(row.amount);
		}
		return {count, amount: Number(amount)};
	}

	/** Computes percentage delta between current and prior values */
	private computeDelta(current: number, prior: number): number {
		if (prior === 0) return current > 0 ? 100 : 0;
		return ((current - prior) / prior) * 100;
	}

	/** Groups cache rows by metric into timezone-aware sparkline buckets */
	private buildCacheSparkline(
		rows: MintAnalytics[],
		metric: MintAnalyticsMetric,
		period_start: number,
		period_end: number,
		bucket_seconds: number,
		timezone: string,
	): OrchardMintActivityBucket[] {
		const tz_offset = DateTime.now().setZone(timezone).offset * 60;
		const adjusted_start = period_start + tz_offset;
		const bucket_start = Math.floor(adjusted_start / bucket_seconds) * bucket_seconds - tz_offset;
		const bucket_count = Math.ceil((period_end - bucket_start) / bucket_seconds);

		const buckets = new Map<number, number>();
		for (let i = 0; i < bucket_count; i++) {
			buckets.set(bucket_start + i * bucket_seconds, 0);
		}

		for (const row of rows) {
			if (row.metric !== metric) continue;
			const adjusted = row.date + tz_offset;
			const key = Math.floor(adjusted / bucket_seconds) * bucket_seconds - tz_offset;
			buckets.set(key, (buckets.get(key) ?? 0) + Number(row.amount));
		}

		return Array.from(buckets.entries())
			.sort(([a], [b]) => a - b)
			.map(([created_time, amount]) => {
				const bucket = new OrchardMintActivityBucket();
				bucket.created_time = created_time;
				bucket.amount = amount;
				return bucket;
			});
	}
}
