/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
import {MintMetricsService} from '@server/modules/cashu/mintmetrics/mintmetrics.service';
import {MintMetrics} from '@server/modules/cashu/mintmetrics/mintmetrics.entity';
import {SystemMetricsInterval} from '@server/modules/system/metrics/sysmetrics.enums';
/* Local Dependencies */
import {ApiMintMetricsService} from './mintmetrics.service.js';

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
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ApiMintMetricsService,
				{provide: MintMetricsService, useValue: {isEnabled: jest.fn(), getMetrics: jest.fn(), scrapeMintMetrics: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		apiMintMetricsService = module.get<ApiMintMetricsService>(ApiMintMetricsService);
		mintMetricsService = module.get(MintMetricsService);
		errorService = module.get(ErrorService);

		mintMetricsService.isEnabled.mockReturnValue(true);
		errorService.resolveError.mockImplementation((_logger, error, _tag, {errord}) => ({
			code: typeof error === 'number' ? error : errord,
		}));
	});

	it('should be defined', () => {
		expect(apiMintMetricsService).toBeDefined();
	});

	describe('support gating', () => {
		it('throws MintSupportError for nutshell mints', async () => {
			mintMetricsService.isEnabled.mockReturnValue(false);
			await expect(apiMintMetricsService.getMetrics('tag', {})).rejects.toBeInstanceOf(OrchardApiError);
			expect(errorService.resolveError).toHaveBeenCalledWith(
				expect.anything(),
				OrchardErrorCode.MintSupportError,
				'tag',
				expect.objectContaining({errord: OrchardErrorCode.MintMetricsError}),
			);
		});

		it('throws MintSupportError when the metrics endpoint env config is unset', async () => {
			mintMetricsService.isEnabled.mockReturnValue(false);
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
			// each delta is attributed to the bucket of its earlier sample (where the traffic occurred)
			mintMetricsService.getMetrics.mockResolvedValue([
				row({date: 3600, value: 10}),
				row({date: 7200, value: 25}),
				row({date: 7260, value: 3}),
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

		it('attributes a counter delta to the interval of the earlier sample, not the next one', async () => {
			// scrapes straddling a minute boundary: 00:01:30 → 00:02:30; the 30 increments happened during minute 00:01
			mintMetricsService.getMetrics.mockResolvedValue([row({date: 90, value: 100}), row({date: 150, value: 130})]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.minute,
				date_start: 0,
				date_end: 300,
			});

			expect(out).toHaveLength(1);
			expect(out[0]).toMatchObject({date: 60, value: 30});
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
			// the zero-delta from 7200→7260 buckets into hour 7200, yielding an empty (null-value) interval
			mintMetricsService.getMetrics.mockResolvedValue([
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 3600, sum: 1, count: 10}),
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 7200, sum: 3, count: 14}),
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 7260, sum: 3, count: 14}),
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

		it('derives histogram deltas across a reset', async () => {
			mintMetricsService.getMetrics.mockResolvedValue([
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 3600, sum: 10, count: 100}),
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 3660, sum: 2, count: 5}),
			]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.hour,
				date_start: 0,
				date_end: 7200,
			});

			// reset: the smaller current sum/count are taken as the interval delta
			expect(out).toHaveLength(1);
			expect(out[0]).toMatchObject({date: 3600, value: 0.4, count: 5});
		});

		it('tolerates malformed bucket json by returning null percentiles', async () => {
			mintMetricsService.getMetrics.mockResolvedValue([
				row({
					metric: 'cdk_mint_operation_duration_seconds',
					type: 'histogram',
					date: 3600,
					sum: 1,
					count: 10,
					buckets: 'not-json{',
				}),
				row({metric: 'cdk_mint_operation_duration_seconds', type: 'histogram', date: 3660, sum: 3, count: 14, buckets: '{bad'}),
			]);

			const out = await apiMintMetricsService.getMetrics('tag', {
				interval: SystemMetricsInterval.hour,
				date_start: 0,
				date_end: 7200,
			});

			// average duration still resolves; percentiles are null because no buckets parsed
			expect(out[0]).toMatchObject({value: 0.5, count: 4, p50: null, p95: null, p99: null});
		});

		it('wraps data source errors in OrchardApiError', async () => {
			mintMetricsService.getMetrics.mockRejectedValue(new Error('boom'));
			await expect(apiMintMetricsService.getMetrics('tag', {})).rejects.toBeInstanceOf(OrchardApiError);
		});
	});

	describe('checkHealth', () => {
		it('returns true when the exporter scrape succeeds', async () => {
			mintMetricsService.scrapeMintMetrics.mockResolvedValue([]);
			await expect(apiMintMetricsService.checkHealth('tag')).resolves.toBe(true);
			expect(mintMetricsService.scrapeMintMetrics).toHaveBeenCalled();
		});

		it('wraps an unreachable exporter in OrchardApiError with MintMetricsError', async () => {
			mintMetricsService.scrapeMintMetrics.mockRejectedValue(new Error('socket hang up'));
			await expect(apiMintMetricsService.checkHealth('tag')).rejects.toBeInstanceOf(OrchardApiError);
			expect(errorService.resolveError).toHaveBeenCalledWith(
				expect.anything(),
				expect.any(Error),
				'tag',
				expect.objectContaining({errord: OrchardErrorCode.MintMetricsError}),
			);
		});

		it('throws without scraping when the backend is unsupported', async () => {
			mintMetricsService.isEnabled.mockReturnValue(false);
			await expect(apiMintMetricsService.checkHealth('tag')).rejects.toBeInstanceOf(OrchardApiError);
			expect(mintMetricsService.scrapeMintMetrics).not.toHaveBeenCalled();
		});
	});

	describe('histogramQuantile', () => {
		// exercises the private percentile core directly to cover its guard/clamp branches
		const quantile = (q: number, buckets: {le: number; count: number}[]): number | null =>
			(apiMintMetricsService as any).histogramQuantile(q, buckets);

		it('returns null for out-of-range quantiles', () => {
			const buckets = [
				{le: 1, count: 5},
				{le: Infinity, count: 10},
			];
			expect(quantile(-0.1, buckets)).toBeNull();
			expect(quantile(1.1, buckets)).toBeNull();
		});

		it('returns null for empty buckets', () => {
			expect(quantile(0.5, [])).toBeNull();
		});

		it('returns null when the total count is zero', () => {
			expect(
				quantile(0.5, [
					{le: 1, count: 0},
					{le: Infinity, count: 0},
				]),
			).toBeNull();
		});

		it('clamps to the largest finite le when the rank falls in the +Inf bucket', () => {
			expect(
				quantile(0.9, [
					{le: 1, count: 5},
					{le: Infinity, count: 10},
				]),
			).toBe(1);
		});

		it('returns the bucket boundary when the first bucket is non-positive', () => {
			expect(
				quantile(0.5, [
					{le: 0, count: 5},
					{le: Infinity, count: 5},
				]),
			).toBe(0);
		});

		it('linearly interpolates within a finite bucket', () => {
			// rank 2.5 of total 5 across [0,1] → 0.5
			expect(
				quantile(0.5, [
					{le: 1, count: 5},
					{le: Infinity, count: 5},
				]),
			).toBeCloseTo(0.5, 5);
		});
	});
});
