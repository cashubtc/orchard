/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {BitcoinAnalyticsService} from '@server/modules/bitcoin/analytics/btcanalytics.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {ApiBitcoinAnalyticsService} from './btcanalytics.service.js';

describe('ApiBitcoinAnalyticsService', () => {
	let service: ApiBitcoinAnalyticsService;
	let bitcoinAnalyticsService: jest.Mocked<BitcoinAnalyticsService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ApiBitcoinAnalyticsService,
				{provide: BitcoinAnalyticsService, useValue: {getCachedAnalytics: jest.fn(), getBackfillStatus: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		service = module.get<ApiBitcoinAnalyticsService>(ApiBitcoinAnalyticsService);
		bitcoinAnalyticsService = module.get(BitcoinAnalyticsService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('returns backfill status', () => {
		bitcoinAnalyticsService.getBackfillStatus.mockReturnValue({is_running: false});

		const result = service.getBackfillStatus('TAG');

		expect(result).toBeDefined();
		expect(result.is_running).toBe(false);
	});

	it('wraps getBackfillStatus errors via resolveError and throws OrchardApiError', () => {
		bitcoinAnalyticsService.getBackfillStatus.mockImplementation(() => {
			throw new Error('boom');
		});
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinAnalyticsError});

		expect(() => service.getBackfillStatus('TAG')).toThrow(OrchardApiError);
	});

	it('wraps getAnalyticsBalance errors via resolveError and throws OrchardApiError', async () => {
		bitcoinAnalyticsService.getCachedAnalytics.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinAnalyticsError});

		await expect(service.getAnalyticsBalance('TAG', {})).rejects.toBeInstanceOf(OrchardApiError);
	});

	it('wraps getAnalyticsMetrics errors via resolveError and throws OrchardApiError', async () => {
		bitcoinAnalyticsService.getCachedAnalytics.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.BitcoinAnalyticsError});

		await expect(service.getAnalyticsMetrics('TAG', {})).rejects.toBeInstanceOf(OrchardApiError);
	});

	describe('getAnalyticsBalance', () => {
		it('returns net balance from cached analytics', async () => {
			bitcoinAnalyticsService.getCachedAnalytics.mockResolvedValue([
				{
					id: '1',
					node_pubkey: 'pk',
					group_key: '',
					unit: 'sat',
					metric: 'payments_in',
					date: 1700000000,
					amount: '100000',
					count: 2,
					updated_at: 0,
				},
				{
					id: '2',
					node_pubkey: 'pk',
					group_key: '',
					unit: 'sat',
					metric: 'payments_out',
					date: 1700000000,
					amount: '30000',
					count: 1,
					updated_at: 0,
				},
				{
					id: '3',
					node_pubkey: 'pk',
					group_key: '',
					unit: 'sat',
					metric: 'fees',
					date: 1700000000,
					amount: '500',
					count: 1,
					updated_at: 0,
				},
			]);

			const result = await service.getAnalyticsBalance('TAG', {});

			expect(result).toHaveLength(1);
			expect(result[0].unit).toBe('sat');
			// Net = 100000 - 30000 - 500 = 69500
			expect(result[0].amount).toBe('69500');
			expect(result[0].count).toBe(4);
		});

		it('filters out zero-net buckets', async () => {
			bitcoinAnalyticsService.getCachedAnalytics.mockResolvedValue([
				{
					id: '1',
					node_pubkey: 'pk',
					group_key: '',
					unit: 'sat',
					metric: 'payments_in',
					date: 1700000000,
					amount: '1000',
					count: 1,
					updated_at: 0,
				},
				{
					id: '2',
					node_pubkey: 'pk',
					group_key: '',
					unit: 'sat',
					metric: 'payments_out',
					date: 1700000000,
					amount: '1000',
					count: 1,
					updated_at: 0,
				},
			]);

			const result = await service.getAnalyticsBalance('TAG', {});

			expect(result).toHaveLength(0);
		});
	});

	describe('getAnalyticsMetrics', () => {
		it('returns per-metric analytics from cached data', async () => {
			bitcoinAnalyticsService.getCachedAnalytics.mockResolvedValue([
				{
					id: '1',
					node_pubkey: 'pk',
					group_key: '',
					unit: 'sat',
					metric: 'payments_in',
					date: 1700000000,
					amount: '50000',
					count: 3,
					updated_at: 0,
				},
				{
					id: '2',
					node_pubkey: 'pk',
					group_key: '',
					unit: 'sat',
					metric: 'fees',
					date: 1700000000,
					amount: '200',
					count: 1,
					updated_at: 0,
				},
			]);

			const result = await service.getAnalyticsMetrics('TAG', {});

			expect(result).toHaveLength(2);
			expect(result[0].metric).toBe('payments_in');
			expect(result[0].amount).toBe('50000');
			expect(result[1].metric).toBe('fees');
			expect(result[1].amount).toBe('200');
		});
	});
});
