/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuMintAnalyticsService} from '@server/modules/cashu/mintanalytics/mintanalytics.service';
import {MintAnalyticsMetric} from '@server/modules/cashu/mintanalytics/mintanalytics.enums';
import {MintAnalytics} from '@server/modules/cashu/mintanalytics/mintanalytics.entity';
import {MintActivityPeriod} from '@server/modules/cashu/mintdb/cashumintdb.enums';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {MintActivityService} from './mintactivity.service.js';
import {OrchardMintActivitySummary} from './mintactivity.model.js';

/** Fixed "now" aligned to an hour boundary for predictable bucket math */
const MOCK_NOW_SECONDS = 1700006400;

/** Helper: builds a cache row with sensible defaults */
function makeCacheRow(overrides: Partial<MintAnalytics> = {}): MintAnalytics {
	return {
		id: 'uuid',
		mint_pubkey: 'pk',
		keyset_id: '',
		unit: 'sat',
		metric: MintAnalyticsMetric.mints_created,
		date: MOCK_NOW_SECONDS - 3600,
		amount: '0',
		count: 0,
		updated_at: MOCK_NOW_SECONDS,
		...overrides,
	} as MintAnalytics;
}

describe('MintActivityService', () => {
	let mintActivityService: MintActivityService;
	let analyticsService: jest.Mocked<CashuMintAnalyticsService>;
	let errorService: jest.Mocked<ErrorService>;
	let date_now_spy: jest.SpyInstance;

	beforeEach(async () => {
		date_now_spy = jest.spyOn(Date, 'now').mockReturnValue(MOCK_NOW_SECONDS * 1000);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintActivityService,
				{
					provide: CashuMintAnalyticsService,
					useValue: {
						getCachedAnalytics: jest.fn().mockResolvedValue([]),
						getBackfillStatus: jest.fn().mockReturnValue({is_running: false}),
					},
				},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintActivityService = module.get<MintActivityService>(MintActivityService);
		analyticsService = module.get(CashuMintAnalyticsService);
		errorService = module.get(ErrorService);
	});

	afterEach(() => {
		date_now_spy.mockRestore();
	});

	it('should be defined', () => {
		expect(mintActivityService).toBeDefined();
	});

	it('returns zero summary when cache is empty', async () => {
		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result).toBeInstanceOf(OrchardMintActivitySummary);
		expect(result.total_operations).toBe(0);
		expect(result.total_volume).toBe(0);
		expect(result.mint_count).toBe(0);
		expect(result.melt_count).toBe(0);
		expect(result.swap_count).toBe(0);
		expect(result.mint_completed_pct).toBe(0);
		expect(result.melt_completed_pct).toBe(0);
		expect(result.mint_avg_time).toBe(0);
		expect(result.melt_avg_time).toBe(0);
		expect(result.warnings).toEqual([]);
	});

	it('fetches correct date ranges for each period', async () => {
		await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.day);
		const calls = analyticsService.getCachedAnalytics.mock.calls;
		const current_args = calls[0][0];
		const prior_args = calls[1][0];

		expect(current_args.date_start).toBe(MOCK_NOW_SECONDS - 86400);
		expect(prior_args.date_start).toBe(MOCK_NOW_SECONDS - 86400 * 2);
		expect(prior_args.date_end).toBe(MOCK_NOW_SECONDS - 86400 - 1);

		analyticsService.getCachedAnalytics.mockClear();
		await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.three_day);
		const three_calls = analyticsService.getCachedAnalytics.mock.calls;
		expect(three_calls[0][0].date_start).toBe(MOCK_NOW_SECONDS - 259200);
	});

	it('computes counts, volumes, and deltas from cache data', async () => {
		const current_rows = [
			makeCacheRow({metric: MintAnalyticsMetric.mints_created, count: 1}),
			makeCacheRow({metric: MintAnalyticsMetric.mints_amount, count: 1, amount: '100'}),
			makeCacheRow({metric: MintAnalyticsMetric.melts_created, count: 1}),
			makeCacheRow({metric: MintAnalyticsMetric.melts_amount, count: 1, amount: '200'}),
			makeCacheRow({metric: MintAnalyticsMetric.swaps_amount, count: 1, amount: '50'}),
		];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce([]);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.mint_count).toBe(1);
		expect(result.melt_count).toBe(1);
		expect(result.swap_count).toBe(1);
		expect(result.total_operations).toBe(3);
		expect(result.total_volume).toBe(350);
	});

	it('computes positive delta when current exceeds prior', async () => {
		const current_rows = [makeCacheRow({metric: MintAnalyticsMetric.mints_created, count: 2})];
		const prior_rows = [makeCacheRow({metric: MintAnalyticsMetric.mints_created, count: 1})];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce(prior_rows);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.mint_count_delta).toBe(100);
	});

	it('computes negative delta when current is less than prior', async () => {
		const current_rows = [makeCacheRow({metric: MintAnalyticsMetric.mints_created, count: 1})];
		const prior_rows = [makeCacheRow({metric: MintAnalyticsMetric.mints_created, count: 2})];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce(prior_rows);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.mint_count_delta).toBe(-50);
	});

	it('returns 100 delta when prior is zero and current has data', async () => {
		const current_rows = [makeCacheRow({metric: MintAnalyticsMetric.mints_created, count: 3})];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce([]);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.mint_count_delta).toBe(100);
	});

	it('returns 0 delta when both periods are zero', async () => {
		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.mint_count_delta).toBe(0);
		expect(result.total_operations_delta).toBe(0);
	});

	it('computes completed percentage from cache metrics', async () => {
		const current_rows = [
			makeCacheRow({metric: MintAnalyticsMetric.mints_created, count: 2}),
			makeCacheRow({metric: MintAnalyticsMetric.mints_amount, count: 1, amount: '100'}),
		];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce([]);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.mint_completed_pct).toBe(50);
	});

	it('computes average time from completion time metrics', async () => {
		const current_rows = [
			makeCacheRow({metric: MintAnalyticsMetric.mints_created, count: 2}),
			makeCacheRow({metric: MintAnalyticsMetric.mints_amount, count: 2, amount: '200'}),
			makeCacheRow({metric: MintAnalyticsMetric.mints_completion_time, count: 2, amount: '800'}),
		];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce([]);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.mint_avg_time).toBe(400);
	});

	it('computes completed percentage and avg time for melt metrics', async () => {
		const current_rows = [
			makeCacheRow({metric: MintAnalyticsMetric.melts_created, count: 2}),
			makeCacheRow({metric: MintAnalyticsMetric.melts_amount, count: 1, amount: '300'}),
			makeCacheRow({metric: MintAnalyticsMetric.melts_completion_time, count: 1, amount: '500'}),
		];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce([]);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.melt_completed_pct).toBe(50);
		expect(result.melt_avg_time).toBe(500);
	});

	it('produces sparkline buckets covering the full period', async () => {
		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week, 'UTC');
		expect(result.mint_sparkline.length).toBe(7);
		expect(result.mint_sparkline.every((b) => b.amount === 0)).toBe(true);
	});

	it('places cache rows into correct sparkline buckets', async () => {
		const period_start = MOCK_NOW_SECONDS - 86400;
		const bucket_seconds = 3600;
		const row_hour = Math.floor((period_start + 1800) / bucket_seconds) * bucket_seconds;

		const current_rows = [makeCacheRow({metric: MintAnalyticsMetric.swaps_amount, date: row_hour, count: 1, amount: '42'})];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce([]);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.day, 'UTC');
		const filled = result.swap_sparkline.find((b) => b.amount > 0);
		expect(filled).toBeDefined();
		expect(filled!.created_time).toBe(row_hour);
		expect(filled!.amount).toBe(42);
	});

	it('sums amounts across all units', async () => {
		const current_rows = [
			makeCacheRow({metric: MintAnalyticsMetric.mints_created, unit: 'sat', count: 3}),
			makeCacheRow({metric: MintAnalyticsMetric.mints_created, unit: 'usd', count: 2}),
			makeCacheRow({metric: MintAnalyticsMetric.mints_amount, unit: 'sat', count: 2, amount: '100'}),
			makeCacheRow({metric: MintAnalyticsMetric.mints_amount, unit: 'usd', count: 1, amount: '50'}),
		];

		analyticsService.getCachedAnalytics.mockResolvedValueOnce(current_rows).mockResolvedValueOnce([]);

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.mint_count).toBe(5);
		expect(result.total_volume).toBe(150);
	});

	it('returns empty warnings when backfill is not running', async () => {
		analyticsService.getBackfillStatus.mockReturnValue({is_running: false});

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.warnings).toEqual([]);
	});

	it('returns warning when backfill is running', async () => {
		analyticsService.getBackfillStatus.mockReturnValue({is_running: true});

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('archived');
	});

	it('includes last processed date in warning when available', async () => {
		analyticsService.getBackfillStatus.mockReturnValue({is_running: true, last_processed_at: 1700000000});

		const result = await mintActivityService.getMintActivitySummary('TAG', MintActivityPeriod.week);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('Currently processing');
		expect(result.warnings[0]).toContain('Nov');
	});

	it('wraps errors via ErrorService and throws OrchardApiError', async () => {
		analyticsService.getCachedAnalytics.mockRejectedValue(new Error('cache error'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseSelectError});

		await expect(mintActivityService.getMintActivitySummary('MY_TAG', MintActivityPeriod.week)).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.MintDatabaseSelectError});
	});
});
