/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {PrometheusService} from '@server/modules/prometheus/prometheus.service';
import {PromFamily} from '@server/modules/prometheus/prometheus.types';
import {SettingService} from '@server/modules/setting/setting.service';
import {SettingKey} from '@server/modules/setting/setting.enums';
/* Local Dependencies */
import {MintMetrics} from './mintmetrics.entity';
import {MintMetricsService} from './mintmetrics.service';

const GAUGE_FAMILY: PromFamily = {
	name: 'process_memory_bytes',
	type: 'gauge',
	samples: [{labels: {}, value: 40730624}],
};

const COUNTER_FAMILY: PromFamily = {
	name: 'cdk_mint_operations_total',
	type: 'counter',
	samples: [
		{labels: {operation: 'get_settings', status: 'success'}, value: 3},
		{labels: {operation: 'start', status: 'success'}, value: 1},
	],
};

const HISTOGRAM_FAMILY: PromFamily = {
	name: 'cdk_mint_operation_duration_seconds',
	type: 'histogram',
	samples: [],
	sum_samples: [{labels: {operation: 'get_settings', status: 'success'}, value: 0.5}],
	count_samples: [{labels: {operation: 'get_settings', status: 'success'}, value: 3}],
	bucket_samples: [
		{labels: {operation: 'get_settings', status: 'success', le: '0.005'}, value: 2},
		{labels: {operation: 'get_settings', status: 'success', le: '0.01'}, value: 3},
		{labels: {operation: 'get_settings', status: 'success', le: '+Inf'}, value: 3},
	],
};

describe('MintMetricsService', () => {
	let mintMetricsService: MintMetricsService;
	let repository: {upsert: jest.Mock; find: jest.Mock; delete: jest.Mock};
	let prometheusService: jest.Mocked<PrometheusService>;
	let settingService: jest.Mocked<SettingService>;

	beforeEach(async () => {
		repository = {upsert: jest.fn(), find: jest.fn(), delete: jest.fn()};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintMetricsService,
				{provide: getRepositoryToken(MintMetrics), useValue: repository},
				{provide: PrometheusService, useValue: {scrapeMetrics: jest.fn()}},
				{provide: SettingService, useValue: {getStringSetting: jest.fn().mockResolvedValue('http://localhost:5553')}},
			],
		}).compile();

		mintMetricsService = module.get<MintMetricsService>(MintMetricsService);
		prometheusService = module.get(PrometheusService);
		settingService = module.get(SettingService);
	});

	it('should be defined', () => {
		expect(mintMetricsService).toBeDefined();
	});

	describe('scrapeMintMetrics', () => {
		it('builds the scrape url from the setting', async () => {
			prometheusService.scrapeMetrics.mockResolvedValue([]);
			await mintMetricsService.scrapeMintMetrics();
			expect(settingService.getStringSetting).toHaveBeenCalledWith(SettingKey.MINT_METRICS_API);
			expect(prometheusService.scrapeMetrics).toHaveBeenCalledWith('http://localhost:5553/metrics');
		});

		it('returns an empty array without scraping when the setting is unset', async () => {
			settingService.getStringSetting.mockResolvedValue(null);
			const out = await mintMetricsService.scrapeMintMetrics();
			expect(out).toEqual([]);
			expect(prometheusService.scrapeMetrics).not.toHaveBeenCalled();
		});
	});

	describe('collectAndStore', () => {
		it('stores gauge, counter and histogram rows with canonical labels', async () => {
			prometheusService.scrapeMetrics.mockResolvedValue([GAUGE_FAMILY, COUNTER_FAMILY, HISTOGRAM_FAMILY]);
			await mintMetricsService.collectAndStore();

			expect(repository.upsert).toHaveBeenCalledTimes(1);
			const [rows, options] = repository.upsert.mock.calls[0];
			expect(options).toEqual({conflictPaths: ['metric', 'labels', 'date']});
			expect(rows).toHaveLength(4);

			const gauge_row = rows.find((r: MintMetrics) => r.metric === 'process_memory_bytes');
			expect(gauge_row).toMatchObject({labels: '', type: 'gauge', value: 40730624, sum: null, count: null});

			const counter_row = rows.find((r: MintMetrics) => r.labels === 'operation=get_settings,status=success' && r.type === 'counter');
			expect(counter_row).toMatchObject({metric: 'cdk_mint_operations_total', value: 3});

			const histogram_row = rows.find((r: MintMetrics) => r.type === 'histogram');
			expect(histogram_row).toMatchObject({
				metric: 'cdk_mint_operation_duration_seconds',
				labels: 'operation=get_settings,status=success',
				value: null,
				sum: 0.5,
				count: 3,
				buckets: JSON.stringify({'0.005': 2, '0.01': 3}),
			});
			expect(gauge_row.buckets).toBeNull();
			expect(gauge_row.date % 60).toBe(0);
		});

		it('drops buckets for histograms exceeding the per-series bucket cap', async () => {
			const bucket_samples = Array.from({length: 65}, (_, i) => ({labels: {operation: 'swap', le: `${i}`}, value: i}));
			prometheusService.scrapeMetrics.mockResolvedValue([
				{
					name: 'cdk_wide_histogram',
					type: 'histogram',
					samples: [],
					sum_samples: [{labels: {operation: 'swap'}, value: 1}],
					count_samples: [{labels: {operation: 'swap'}, value: 64}],
					bucket_samples,
				},
			]);
			await mintMetricsService.collectAndStore();

			const [rows] = repository.upsert.mock.calls[0];
			expect(rows[0].buckets).toBeNull();
		});

		it('filters out families that are not cdk_ or process_ prefixed', async () => {
			prometheusService.scrapeMetrics.mockResolvedValue([{name: 'other_metric', type: 'gauge', samples: [{labels: {}, value: 1}]}]);
			await mintMetricsService.collectAndStore();
			expect(repository.upsert).not.toHaveBeenCalled();
		});

		it('skips families exceeding the cardinality limit', async () => {
			const samples = Array.from({length: 101}, (_, i) => ({labels: {operation: `op_${i}`}, value: i}));
			prometheusService.scrapeMetrics.mockResolvedValue([{name: 'cdk_exploding', type: 'counter', samples}]);
			await mintMetricsService.collectAndStore();
			expect(repository.upsert).not.toHaveBeenCalled();
		});

		it('swallows scrape errors and recovers without throwing', async () => {
			prometheusService.scrapeMetrics.mockRejectedValueOnce(new Error('ECONNREFUSED'));
			await expect(mintMetricsService.collectAndStore()).resolves.toBeUndefined();
			expect(repository.upsert).not.toHaveBeenCalled();

			prometheusService.scrapeMetrics.mockResolvedValue([GAUGE_FAMILY]);
			await mintMetricsService.collectAndStore();
			expect(repository.upsert).toHaveBeenCalledTimes(1);
		});
	});

	describe('getMetrics', () => {
		it('returns an empty array for inverted date ranges', async () => {
			const out = await mintMetricsService.getMetrics(100, 50);
			expect(out).toEqual([]);
			expect(repository.find).not.toHaveBeenCalled();
		});

		it('queries by date range ordered ascending', async () => {
			repository.find.mockResolvedValue([]);
			await mintMetricsService.getMetrics(0, 100, ['cdk_errors_total']);
			expect(repository.find).toHaveBeenCalledWith(
				expect.objectContaining({
					order: {date: 'ASC'},
				}),
			);
		});
	});
});
