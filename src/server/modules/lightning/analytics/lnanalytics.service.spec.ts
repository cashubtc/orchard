/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
/* Application Dependencies */
import {LightningService} from '@server/modules/lightning/lightning/lightning.service';
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {AnalyticsCheckpoint} from '@server/modules/analytics/analytics-checkpoint.entity';
/* Local Dependencies */
import {LightningAnalyticsService} from './lnanalytics.service.js';
import {LightningAnalytics} from './lnanalytics.entity.js';

describe('LightningAnalyticsService', () => {
	let service: LightningAnalyticsService;
	let lightningService: jest.Mocked<LightningService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LightningAnalyticsService,
				{
					provide: getRepositoryToken(LightningAnalytics),
					useValue: {find: jest.fn(), findOne: jest.fn(), count: jest.fn(), upsert: jest.fn()},
				},
				{
					provide: getRepositoryToken(AnalyticsCheckpoint),
					useValue: {findOne: jest.fn(), upsert: jest.fn()},
				},
				{
					provide: DataSource,
					useValue: {transaction: jest.fn()},
				},
				{
					provide: LightningService,
					useValue: {
						isConfigured: jest.fn().mockReturnValue(false),
						getLightningInfo: jest.fn(),
						getChannels: jest.fn(),
						getClosedChannels: jest.fn(),
						getTransactions: jest.fn(),
						getPayments: jest.fn(),
						getInvoices: jest.fn(),
						getForwards: jest.fn(),
					},
				},
				{
					provide: BitcoinRpcService,
					useValue: {isConfigured: jest.fn().mockReturnValue(false), getTransaction: jest.fn()},
				},
			],
		}).compile();

		service = module.get<LightningAnalyticsService>(LightningAnalyticsService);
		lightningService = module.get(LightningService);
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

		expect(lightningService.getChannels).not.toHaveBeenCalled();
	});
});
