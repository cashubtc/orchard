/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {LightningAnalyticsService} from '@server/modules/lightning/analytics/lnanalytics.service';
import {LightningAnalyticsMetric} from '@server/modules/lightning/analytics/lnanalytics.enums';
import {AnalyticsInterval} from '@server/modules/analytics/analytics.enums';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {ApiLightningAnalyticsService} from './lnanalytics.service.js';

describe('ApiLightningAnalyticsService', () => {
	let service: ApiLightningAnalyticsService;
	let lightningAnalyticsService: jest.Mocked<LightningAnalyticsService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ApiLightningAnalyticsService,
				{provide: LightningAnalyticsService, useValue: {getCachedAnalytics: jest.fn(), getBackfillStatus: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		service = module.get<ApiLightningAnalyticsService>(ApiLightningAnalyticsService);
		lightningAnalyticsService = module.get(LightningAnalyticsService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('returns backfill status', () => {
		lightningAnalyticsService.getBackfillStatus.mockReturnValue({is_running: false});

		const result = service.getBackfillStatus('TAG');

		expect(result).toBeDefined();
		expect(result.is_running).toBe(false);
	});

	it('wraps getBackfillStatus errors via resolveError and throws OrchardApiError', () => {
		lightningAnalyticsService.getBackfillStatus.mockImplementation(() => {
			throw new Error('boom');
		});
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.LightningRpcActionError});

		expect(() => service.getBackfillStatus('TAG')).toThrow(OrchardApiError);
	});

	it('wraps getAnalyticsLocalBalance errors via resolveError and throws OrchardApiError', async () => {
		lightningAnalyticsService.getCachedAnalytics.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.LightningRpcActionError});

		await expect(service.getAnalyticsLocalBalance('TAG', {})).rejects.toBeInstanceOf(OrchardApiError);
	});

	it('wraps getAnalyticsRemoteBalance errors via resolveError and throws OrchardApiError', async () => {
		lightningAnalyticsService.getCachedAnalytics.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.LightningRpcActionError});

		await expect(service.getAnalyticsRemoteBalance('TAG', {})).rejects.toBeInstanceOf(OrchardApiError);
	});

	it('wraps getAnalyticsMetrics errors via resolveError and throws OrchardApiError', async () => {
		lightningAnalyticsService.getCachedAnalytics.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.LightningRpcActionError});

		await expect(service.getAnalyticsMetrics('TAG', {})).rejects.toBeInstanceOf(OrchardApiError);
	});

	/* *******************************************************
		getNetBalance same-bucket accumulator

		Regression guard for silent channel_opens drop in the assets line of
		the mint-dashboard Balance Sheet chart. At `hour` interval, aggregateByIntervalSimple
		is a passthrough, so multiple positive-metric rows sharing (unit, hour)
		reached the positive_map and collided. The old code used `Map.set` which
		replaced instead of accumulating, dropping all but the last row. Real
		reproduction across docker stacks: returned invoices_in - payments_out
		at the channel-open hour, silently omitting the 10_000_000_000 msat open.
	******************************************************** */

	it('sums multiple same-bucket positive/negative rows at hour interval instead of overwriting', async () => {
		const hour = 1777039200;
		lightningAnalyticsService.getCachedAnalytics.mockResolvedValue([
			{metric: LightningAnalyticsMetric.channel_opens, unit: 'msat', amount: '10000000000', date: hour} as any,
			{metric: LightningAnalyticsMetric.invoices_in, unit: 'msat', amount: '9472000', date: hour} as any,
			{metric: LightningAnalyticsMetric.forward_fees, unit: 'msat', amount: '6013', date: hour} as any,
			{metric: LightningAnalyticsMetric.payments_out, unit: 'msat', amount: '5570000', date: hour} as any,
			{metric: LightningAnalyticsMetric.channel_closes, unit: 'msat', amount: '3000', date: hour} as any,
		]);

		const result = await service.getAnalyticsLocalBalance('TAG', {interval: AnalyticsInterval.hour});

		// Positive = 10_000_000_000 + 9_472_000 + 6_013 = 10_009_478_013
		// Negative = 5_570_000 + 3_000 = 5_573_000
		// Net = 10_003_905_013
		expect(result).toHaveLength(1);
		expect(result[0].unit).toBe('msat');
		expect(result[0].date).toBe(hour);
		expect(result[0].amount).toBe('10003905013');
	});
});
