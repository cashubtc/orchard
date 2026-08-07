/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
/* Application Dependencies */
import {CashuMintAnalyticsService} from '@server/modules/cashu/mintanalytics/mintanalytics.service';
import {MintAnalyticsMetric} from '@server/modules/cashu/mintanalytics/mintanalytics.enums';
import {AnalyticsInterval} from '@server/modules/analytics/analytics.enums';
import {ErrorService} from '@server/modules/error/error.service';
/* Local Dependencies */
import {MintAnalyticsService} from './mintanalytics.service.js';

describe('MintAnalyticsService', () => {
	let service: MintAnalyticsService;

	const mock_cashu_analytics = {
		getCachedAnalytics: jest.fn().mockResolvedValue([]),
		getBackfillStatus: jest.fn().mockReturnValue({is_running: false}),
	};

	const mock_error_service = {
		resolveError: jest.fn().mockReturnValue({code: 5000, details: 'test error'}),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintAnalyticsService,
				{provide: CashuMintAnalyticsService, useValue: mock_cashu_analytics},
				{provide: ErrorService, useValue: mock_error_service},
			],
		}).compile();

		service = module.get<MintAnalyticsService>(MintAnalyticsService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	/* *******************************************************
		Metric delegation
	******************************************************** */

	describe('getMetricAnalytics delegation', () => {
		it('getMintAnalyticsMints should query mints_amount metric', async () => {
			await service.getMintAnalyticsMints('test', {});

			expect(mock_cashu_analytics.getCachedAnalytics).toHaveBeenCalledWith(
				expect.objectContaining({metrics: [MintAnalyticsMetric.mints_amount]}),
			);
		});

		it('getMintAnalyticsMelts should query melts_amount metric', async () => {
			await service.getMintAnalyticsMelts('test', {});

			expect(mock_cashu_analytics.getCachedAnalytics).toHaveBeenCalledWith(
				expect.objectContaining({metrics: [MintAnalyticsMetric.melts_amount]}),
			);
		});

		it('getMintAnalyticsSwaps should query swaps_amount metric', async () => {
			await service.getMintAnalyticsSwaps('test', {});

			expect(mock_cashu_analytics.getCachedAnalytics).toHaveBeenCalledWith(
				expect.objectContaining({metrics: [MintAnalyticsMetric.swaps_amount]}),
			);
		});

		it('getMintAnalyticsFees should query fees_amount metric', async () => {
			await service.getMintAnalyticsFees('test', {});

			expect(mock_cashu_analytics.getCachedAnalytics).toHaveBeenCalledWith(
				expect.objectContaining({metrics: [MintAnalyticsMetric.fees_amount]}),
			);
		});

		it('getMintAnalyticsProofs should query redeemed_amount metric', async () => {
			await service.getMintAnalyticsProofs('test', {});

			expect(mock_cashu_analytics.getCachedAnalytics).toHaveBeenCalledWith(
				expect.objectContaining({metrics: [MintAnalyticsMetric.redeemed_amount]}),
			);
		});

		it('getMintAnalyticsPromises should query issued_amount metric', async () => {
			await service.getMintAnalyticsPromises('test', {});

			expect(mock_cashu_analytics.getCachedAnalytics).toHaveBeenCalledWith(
				expect.objectContaining({metrics: [MintAnalyticsMetric.issued_amount]}),
			);
		});
	});

	/* *******************************************************
		getMintAnalyticsBalances
	******************************************************** */

	describe('getMintAnalyticsBalances', () => {
		it('should compute balance as issued minus redeemed', async () => {
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.issued_amount, unit: 'sat', amount: '1000', date: 1700000000, count: 1, keyset_id: ''},
				{metric: MintAnalyticsMetric.redeemed_amount, unit: 'sat', amount: '300', date: 1700000000, count: 1, keyset_id: ''},
			]);

			const result = await service.getMintAnalyticsBalances('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(1);
			expect(result[0].unit).toBe('sat');
			expect(result[0].amount).toBe('700');
		});

		it('should filter out zero balances', async () => {
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.issued_amount, unit: 'sat', amount: '500', date: 1700000000, count: 1, keyset_id: ''},
				{metric: MintAnalyticsMetric.redeemed_amount, unit: 'sat', amount: '500', date: 1700000000, count: 1, keyset_id: ''},
			]);

			const result = await service.getMintAnalyticsBalances('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(0);
		});

		it('should return empty when no cached data', async () => {
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([]);

			const result = await service.getMintAnalyticsBalances('test', {});

			expect(result).toEqual([]);
		});

		/**
		 * Defensive guard mirroring the lightning-analytics getNetBalance fix:
		 * multiple rows sharing (unit, hour) must accumulate, not overwrite.
		 * Not hit in practice today (one issued_amount / redeemed_amount row per
		 * (unit, hour) because keyset_id is always '' for these metrics), but the
		 * shape of the code was identical to the buggy lightning version.
		 */
		it('sums multiple same-bucket issued/redeemed rows at hour interval instead of overwriting', async () => {
			const hour = 1700000000;
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.issued_amount, unit: 'sat', amount: '1000', date: hour, count: 1, keyset_id: ''},
				{metric: MintAnalyticsMetric.issued_amount, unit: 'sat', amount: '2500', date: hour, count: 1, keyset_id: ''},
				{metric: MintAnalyticsMetric.redeemed_amount, unit: 'sat', amount: '200', date: hour, count: 1, keyset_id: ''},
				{metric: MintAnalyticsMetric.redeemed_amount, unit: 'sat', amount: '100', date: hour, count: 1, keyset_id: ''},
			]);

			const result = await service.getMintAnalyticsBalances('test', {interval: AnalyticsInterval.hour});

			// issued = 1000 + 2500 = 3500, redeemed = 200 + 100 = 300, balance = 3200
			expect(result).toHaveLength(1);
			expect(result[0].amount).toBe('3200');
			expect(result[0].date).toBe(hour);
		});
	});

	/* *******************************************************
		getAnalyticsMetrics
	******************************************************** */

	describe('getAnalyticsMetrics', () => {
		it('should return metrics with preserved metric dimension', async () => {
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.mints_amount, unit: 'sat', amount: '1000', date: 1700000000, count: 5, keyset_id: ''},
				{metric: MintAnalyticsMetric.melts_amount, unit: 'sat', amount: '200', date: 1700000000, count: 2, keyset_id: ''},
			]);

			const result = await service.getAnalyticsMetrics('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(2);
			expect(result[0].metric).toBe(MintAnalyticsMetric.mints_amount);
			expect(result[1].metric).toBe(MintAnalyticsMetric.melts_amount);
		});

		it('should filter zero amounts', async () => {
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.mints_amount, unit: 'sat', amount: '0', date: 1700000000, count: 0, keyset_id: ''},
			]);

			const result = await service.getAnalyticsMetrics('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(0);
		});
	});

	/* *******************************************************
		getMintAnalyticsKeysets
	******************************************************** */

	describe('getMintAnalyticsKeysets', () => {
		it('should return issued amount when only issued data is present', async () => {
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.keyset_issued, unit: 'sat', amount: '500', date: 1700000000, count: 3, keyset_id: 'ks-001'},
			]);

			const result = await service.getMintAnalyticsKeysets('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(1);
			expect(result[0].keyset_id).toBe('ks-001');
			expect(result[0].amount).toBe('500');
		});

		it('should net issued − redeemed per keyset per bucket', async () => {
			const hour = 1700000000;
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.keyset_issued, unit: 'sat', amount: '6501', date: hour, count: 83, keyset_id: 'ks-001'},
				{metric: MintAnalyticsMetric.keyset_redeemed, unit: 'sat', amount: '1821', date: hour, count: 43, keyset_id: 'ks-001'},
			]);

			const result = await service.getMintAnalyticsKeysets('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(1);
			expect(result[0].keyset_id).toBe('ks-001');
			expect(result[0].amount).toBe('4680');
		});

		it('should produce a negative amount when redeemed exceeds issued in a bucket', async () => {
			const hour = 1700000000;
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.keyset_issued, unit: 'sat', amount: '100', date: hour, count: 1, keyset_id: 'ks-001'},
				{metric: MintAnalyticsMetric.keyset_redeemed, unit: 'sat', amount: '700', date: hour, count: 5, keyset_id: 'ks-001'},
			]);

			const result = await service.getMintAnalyticsKeysets('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(1);
			expect(result[0].amount).toBe('-600');
		});

		it('should drop buckets where issued equals redeemed', async () => {
			const hour = 1700000000;
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.keyset_issued, unit: 'sat', amount: '1000', date: hour, count: 5, keyset_id: 'ks-001'},
				{metric: MintAnalyticsMetric.keyset_redeemed, unit: 'sat', amount: '1000', date: hour, count: 5, keyset_id: 'ks-001'},
			]);

			const result = await service.getMintAnalyticsKeysets('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(0);
		});

		it('should net per (keyset, bucket) and sort by date when aggregating to day', async () => {
			const day_one_hour_one = 1700000000;
			const day_one_hour_two = day_one_hour_one + 3600;
			const day_two_hour_one = day_one_hour_one + 86400;
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{
					metric: MintAnalyticsMetric.keyset_issued,
					unit: 'sat',
					amount: '500',
					date: day_two_hour_one,
					count: 3,
					keyset_id: 'ks-002',
				},
				{
					metric: MintAnalyticsMetric.keyset_issued,
					unit: 'sat',
					amount: '300',
					date: day_one_hour_one,
					count: 2,
					keyset_id: 'ks-001',
				},
				{
					metric: MintAnalyticsMetric.keyset_issued,
					unit: 'sat',
					amount: '200',
					date: day_one_hour_two,
					count: 1,
					keyset_id: 'ks-001',
				},
				{
					metric: MintAnalyticsMetric.keyset_redeemed,
					unit: 'sat',
					amount: '100',
					date: day_one_hour_one,
					count: 1,
					keyset_id: 'ks-001',
				},
			]);

			const result = await service.getMintAnalyticsKeysets('test', {interval: AnalyticsInterval.day, timezone: 'UTC'});

			expect(result).toHaveLength(2);
			// ks-001 day 1: (300 + 200) − 100 = 400
			expect(result[0].keyset_id).toBe('ks-001');
			expect(result[0].amount).toBe('400');
			// ks-002 day 2: 500 − 0 = 500
			expect(result[1].keyset_id).toBe('ks-002');
			expect(result[1].amount).toBe('500');
		});

		it('should exclude entries with empty keyset_id', async () => {
			mock_cashu_analytics.getCachedAnalytics.mockResolvedValueOnce([
				{metric: MintAnalyticsMetric.keyset_issued, unit: 'sat', amount: '500', date: 1700000000, count: 3, keyset_id: ''},
			]);

			const result = await service.getMintAnalyticsKeysets('test', {interval: AnalyticsInterval.hour});

			expect(result).toHaveLength(0);
		});
	});

	/* *******************************************************
		getBackfillStatus
	******************************************************** */

	describe('getBackfillStatus', () => {
		it('should return the backfill status from cashu service', () => {
			mock_cashu_analytics.getBackfillStatus.mockReturnValueOnce({is_running: true, first_processed_at: 1700000000, errors: 0});

			const result = service.getBackfillStatus('test');

			expect(result.is_running).toBe(true);
			expect(result.first_processed_at).toBe(1700000000);
		});
	});

	/* *******************************************************
		Error handling
	******************************************************** */

	describe('error handling', () => {
		it('should wrap errors in OrchardApiError via ErrorService', async () => {
			mock_cashu_analytics.getCachedAnalytics.mockRejectedValueOnce(new Error('DB connection lost'));

			await expect(service.getMintAnalyticsMints('test', {})).rejects.toThrow();

			expect(mock_error_service.resolveError).toHaveBeenCalled();
		});

		it('should wrap getBackfillStatus errors', () => {
			mock_cashu_analytics.getBackfillStatus.mockImplementationOnce(() => {
				throw new Error('not configured');
			});

			expect(() => service.getBackfillStatus('test')).toThrow();
			expect(mock_error_service.resolveError).toHaveBeenCalled();
		});
	});

	/* *******************************************************
		Query parameter resolution
	******************************************************** */

	describe('resolveQueryParams', () => {
		it('should pass unit filters to getCachedAnalytics', async () => {
			await service.getMintAnalyticsMints('test', {units: ['sat' as any, 'usd' as any]});

			expect(mock_cashu_analytics.getCachedAnalytics).toHaveBeenCalledWith(expect.objectContaining({units: ['sat', 'usd']}));
		});

		it('should pass date_start to getCachedAnalytics', async () => {
			await service.getMintAnalyticsMints('test', {date_start: 1700000000});

			expect(mock_cashu_analytics.getCachedAnalytics).toHaveBeenCalledWith(expect.objectContaining({date_start: 1700000000}));
		});
	});
});
