/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {TaprootAssetsService} from '#server/modules/tapass/tapass/tapass.service';
import {AnalyticsCheckpoint} from '#server/modules/analytics/analytics-checkpoint.entity';
/* Local Dependencies */
import {BitcoinAnalyticsService} from './btcanalytics.service.js';
import {BitcoinAnalytics} from './btcanalytics.entity.js';
import {BitcoinAnalyticsMetric} from './btcanalytics.enums.js';

describe('BitcoinAnalyticsService', () => {
	let service: BitcoinAnalyticsService;
	let lightningService: jest.Mocked<LightningService>;
	let taprootAssetsService: jest.Mocked<TaprootAssetsService>;
	let analyticsRepo: {find: jest.Mock; findOne: jest.Mock; count: jest.Mock; upsert: jest.Mock};
	let checkpointRepo: {findOne: jest.Mock; upsert: jest.Mock};

	beforeEach(async () => {
		analyticsRepo = {find: jest.fn(), findOne: jest.fn(), count: jest.fn(), upsert: jest.fn()};
		checkpointRepo = {findOne: jest.fn(), upsert: jest.fn()};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BitcoinAnalyticsService,
				{
					provide: getRepositoryToken(BitcoinAnalytics),
					useValue: analyticsRepo,
				},
				{
					provide: getRepositoryToken(AnalyticsCheckpoint),
					useValue: checkpointRepo,
				},
				{
					provide: LightningService,
					useValue: {
						isConfigured: jest.fn().mockReturnValue(false),
						getLightningInfo: jest.fn().mockResolvedValue({identity_pubkey: 'test_pubkey'}),
						getTransactions: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: TaprootAssetsService,
					useValue: {
						getListTaprootAssets: jest.fn().mockResolvedValue({assets: []}),
						getListTransfers: jest.fn().mockResolvedValue({transfers: []}),
						getAddrReceives: jest.fn().mockResolvedValue({events: []}),
					},
				},
			],
		}).compile();

		service = module.get<BitcoinAnalyticsService>(BitcoinAnalyticsService);
		lightningService = module.get(LightningService);
		taprootAssetsService = module.get(TaprootAssetsService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('returns backfill status with is_running false by default', () => {
		const status = service.getBackfillStatus();

		expect(status).toBeDefined();
		expect(status.is_running).toBe(false);
	});

	it('skips auto-backfill when lightning is not configured', async () => {
		lightningService.isConfigured.mockReturnValue(false);

		await service.onApplicationBootstrap();

		expect(lightningService.getTransactions).not.toHaveBeenCalled();
	});

	it('runs backfill on bootstrap when lightning is configured', async () => {
		lightningService.isConfigured.mockReturnValue(true);
		checkpointRepo.findOne.mockResolvedValue(null);

		await service.onApplicationBootstrap();
		// Bootstrap is fire-and-forget so the port binds immediately; flush microtasks
		// so the detached backfill promise advances to its first awaited RPC call.
		await new Promise((resolve) => setImmediate(resolve));
		await new Promise((resolve) => setImmediate(resolve));

		expect(lightningService.getTransactions).toHaveBeenCalled();
	});

	it('guards against concurrent backfill execution', async () => {
		lightningService.isConfigured.mockReturnValue(true);
		checkpointRepo.findOne.mockResolvedValue(null);

		// Start first backfill (will resolve quickly with no transactions)
		const first = service.runStreamingBackfill();

		// Second call should be rejected (is_running guard)
		const second = service.runStreamingBackfill();

		await first;
		await second;

		// getTransactions should only have been called once (from the first backfill)
		expect(lightningService.getTransactions).toHaveBeenCalledTimes(1);
	});

	describe('getCachedAnalytics', () => {
		it('returns empty array when date_end < date_start', async () => {
			const result = await service.getCachedAnalytics(1000, 500, [BitcoinAnalyticsMetric.payments_in]);

			expect(result).toEqual([]);
			expect(analyticsRepo.find).not.toHaveBeenCalled();
		});

		it('queries repository with correct parameters', async () => {
			analyticsRepo.find.mockResolvedValue([]);

			await service.getCachedAnalytics(1700000000, 1700003600, [BitcoinAnalyticsMetric.payments_in]);

			expect(analyticsRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({node_pubkey: 'test_pubkey'}),
					order: {date: 'ASC'},
				}),
			);
		});

		it('filters by group_key when null (BTC only)', async () => {
			analyticsRepo.find.mockResolvedValue([]);

			await service.getCachedAnalytics(1700000000, 1700003600, [BitcoinAnalyticsMetric.payments_in], null);

			expect(analyticsRepo.find).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({group_key: ''}),
				}),
			);
		});
	});

	describe('backfillBtcTransactions', () => {
		it('upserts metrics for transactions grouped by hour', async () => {
			lightningService.isConfigured.mockReturnValue(true);
			checkpointRepo.findOne.mockResolvedValue(null);
			lightningService.getTransactions.mockResolvedValue([
				{tx_hash: 'tx1', time_stamp: 1700000100, amount: '50000', total_fees: '250'},
				{tx_hash: 'tx2', time_stamp: 1700000200, amount: '-30000', total_fees: '150'},
			]);
			taprootAssetsService.getListTaprootAssets.mockRejectedValue(new Error('not configured'));

			await service.runStreamingBackfill();

			// Should upsert payments_in, payments_out, and fees
			expect(analyticsRepo.upsert).toHaveBeenCalledTimes(3);

			// Verify payments_in upsert
			expect(analyticsRepo.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					metric: BitcoinAnalyticsMetric.payments_in,
					amount: '50000',
					count: 1,
					unit: 'sat',
				}),
				expect.any(Object),
			);

			// Verify payments_out upsert (stored as positive)
			expect(analyticsRepo.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					metric: BitcoinAnalyticsMetric.payments_out,
					amount: '30000',
					count: 1,
					unit: 'sat',
				}),
				expect.any(Object),
			);

			// Verify fees upsert
			expect(analyticsRepo.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					metric: BitcoinAnalyticsMetric.fees,
					unit: 'sat',
				}),
				expect.any(Object),
			);

			// Verify checkpoint was saved
			expect(checkpointRepo.upsert).toHaveBeenCalledWith(
				expect.objectContaining({module: 'bitcoin', data_type: 'transactions'}),
				expect.any(Array),
			);
		});

		it('skips transactions with null amount (CLN)', async () => {
			lightningService.isConfigured.mockReturnValue(true);
			checkpointRepo.findOne.mockResolvedValue(null);
			lightningService.getTransactions.mockResolvedValue([{tx_hash: 'tx1', time_stamp: 1700000100, amount: null, total_fees: null}]);
			taprootAssetsService.getListTaprootAssets.mockRejectedValue(new Error('not configured'));

			await service.runStreamingBackfill();

			// No analytics should be upserted
			expect(analyticsRepo.upsert).not.toHaveBeenCalled();
		});
	});
});
