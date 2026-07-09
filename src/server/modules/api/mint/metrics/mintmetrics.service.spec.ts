/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
import {SettingService} from '@server/modules/setting/setting.service';
import {MintMetricsService} from '@server/modules/cashu/mintmetrics/mintmetrics.service';
import {MintMetrics} from '@server/modules/cashu/mintmetrics/mintmetrics.entity';
import {SystemMetricsInterval} from '@server/modules/system/metrics/sysmetrics.enums';
/* Local Dependencies */
import {ApiMintMetricsService} from './mintmetrics.service';

/** Builds a stored metric row with defaults */
const row = (overrides: Partial<MintMetrics>): MintMetrics =>
	({
		id: 'id',
		metric: 'cdk_errors_total',
		labels: '',
		type: 'counter',
		date: 0,
		value: null,
		sum: null,
		count: null,
		buckets: null,
		updated_at: 0,
		...overrides,
	}) as MintMetrics;

describe('ApiMintMetricsService', () => {
	let apiMintMetricsService: ApiMintMetricsService;
	let mintMetricsService: jest.Mocked<MintMetricsService>;
	let configService: jest.Mocked<ConfigService>;
	let settingService: jest.Mocked<SettingService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ApiMintMetricsService,
				{provide: MintMetricsService, useValue: {getMetrics: jest.fn(), scrapeMintMetrics: jest.fn()}},
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: SettingService, useValue: {getStringSetting: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		apiMintMetricsService = module.get<ApiMintMetricsService>(ApiMintMetricsService);
		mintMetricsService = module.get(MintMetricsService);
		configService = module.get(ConfigService);
		settingService = module.get(SettingService);
		errorService = module.get(ErrorService);

		configService.get.mockReturnValue('cdk');
		settingService.getStringSetting.mockResolvedValue('http://localhost:5553');
		errorService.resolveError.mockImplementation((_logger, error, _tag, {errord}) => ({
			code: typeof error === 'number' ? error : errord,
		}));
	});

	it('should be defined', () => {
		expect(apiMintMetricsService).toBeDefined();
	});

	describe('support gating', () => {
		it('throws MintSupportError for nutshell mints', async () => {
			configService.get.mockReturnValue('nutshell');
			await expect(apiMintMetricsService.getMetrics('tag', {})).rejects.toBeInstanceOf(OrchardApiError);
			expect(errorService.resolveError).toHaveBeenCalledWith(
				expect.anything(),
				OrchardErrorCode.MintSupportError,
				'tag',
				expect.objectContaining({errord: OrchardErrorCode.MintMetricsError}),
			);
		});

		it('throws MintSupportError when the metrics endpoint setting is unset', async () => {
			settingService.getStringSetting.mockResolvedValue(null);
			await expect(apiMintMetricsService.getMetrics('tag', {})).rejects.toBeInstanceOf(OrchardApiError);
		});
	});

	describe('getMetrics', () => {
		it('aggregates gauges into avg/min/max buckets', async () => {
			mintMetricsService.getMetrics.mockResolvedValue([
				row({metric: 'process_cpu_usage_percent', type: 'gauge', date: 3600, value: 10}),
				row({metric: 'process_cpu_usage_percent', type: 'gauge', date: 3660, value: 30}),
			]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.hour,
				date_start: 0,
				date_end: 7200,
			});

			expect(out).toHaveLength(1);
			expect(out[0]).toMatchObject({metric: 'process_cpu_usage_percent', date: 3600, value: 20, min: 10, max: 30});
		});

		it('derives counter deltas and detects resets', async () => {
			mintMetricsService.getMetrics.mockResolvedValue([
				row({date: 3600, value: 10}),
				row({date: 3660, value: 25}),
				row({date: 7200, value: 3}),
			]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.hour,
				date_start: 0,
				date_end: 9000,
			});

			expect(out).toHaveLength(2);
			expect(out[0]).toMatchObject({date: 3600, value: 15});
			expect(out[1]).toMatchObject({date: 7200, value: 3});
		});

		it('keeps series with different labels separate', async () => {
			mintMetricsService.getMetrics.mockResolvedValue([
				row({metric: 'cdk_mint_operations_total', labels: 'operation=swap', date: 3600, value: 1}),
				row({metric: 'cdk_mint_operations_total', labels: 'operation=mint', date: 3600, value: 5}),
				row({metric: 'cdk_mint_operations_total', labels: 'operation=swap', date: 3660, value: 4}),
				row({metric: 'cdk_mint_operations_total', labels: 'operation=mint', date: 3660, value: 6}),
			]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.hour,
				date_start: 0,
				date_end: 7200,
			});

			expect(out).toHaveLength(2);
			const swap = out.find((m) => m.labels.some((l) => l.value === 'swap'));
			const mint = out.find((m) => m.labels.some((l) => l.value === 'mint'));
			expect(swap?.value).toBe(3);
			expect(mint?.value).toBe(1);
		});

		it('derives histogram average durations with null for empty intervals', async () => {
			mintMetricsService.getMetrics.mockResolvedValue([
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 3600, sum: 1, count: 10}),
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 3660, sum: 3, count: 14}),
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 7200, sum: 3, count: 14}),
			]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.hour,
				date_start: 0,
				date_end: 9000,
			});

			expect(out).toHaveLength(2);
			expect(out[0]).toMatchObject({date: 3600, value: 0.5, count: 4});
			expect(out[1]).toMatchObject({date: 7200, value: null, count: 0});
		});

		it('computes p50/p95/p99 from interval bucket deltas', async () => {
			mintMetricsService.getMetrics.mockResolvedValue([
				row({
					metric: 'cdk_mint_operation_duration_seconds',
					type: 'histogram',
					date: 3600,
					sum: 0,
					count: 0,
					buckets: JSON.stringify({'0.005': 0, '0.01': 0, '0.05': 0, '0.1': 0, '0.5': 0}),
				}),
				row({
					metric: 'cdk_mint_operation_duration_seconds',
					type: 'histogram',
					date: 3660,
					sum: 0.3,
					count: 10,
					buckets: JSON.stringify({'0.005': 0, '0.01': 0, '0.05': 5, '0.1': 8, '0.5': 10}),
				}),
			]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.hour,
				date_start: 0,
				date_end: 7200,
			});

			expect(out).toHaveLength(1);
			expect(out[0].p50).toBeCloseTo(0.05, 5);
			expect(out[0].p95).toBeCloseTo(0.4, 5);
			expect(out[0].p99).toBeCloseTo(0.48, 5);
			expect(out[0].p50!).toBeLessThanOrEqual(out[0].p95!);
			expect(out[0].p95!).toBeLessThanOrEqual(out[0].p99!);
		});

		it('returns null percentiles for histograms without bucket data', async () => {
			mintMetricsService.getMetrics.mockResolvedValue([
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 3600, sum: 1, count: 10}),
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 3660, sum: 3, count: 14}),
			]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.hour,
				date_start: 0,
				date_end: 7200,
			});

			expect(out[0]).toMatchObject({p50: null, p95: null, p99: null});
		});

		it('wraps data source errors in OrchardApiError', async () => {
			mintMetricsService.getMetrics.mockRejectedValue(new Error('boom'));
			await expect(apiMintMetricsService.getMetrics('tag', {})).rejects.toBeInstanceOf(OrchardApiError);
		});
	});
});
