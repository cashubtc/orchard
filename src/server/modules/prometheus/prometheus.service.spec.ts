/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {FetchService} from '@server/modules/fetch/fetch.service';
/* Local Dependencies */
import {PrometheusService} from './prometheus.service.js';

describe('PrometheusService', () => {
	let prometheusService: PrometheusService;
	let fetchService: jest.Mocked<FetchService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PrometheusService, {provide: FetchService, useValue: {fetchWithProxy: jest.fn()}}],
		}).compile();

		prometheusService = module.get<PrometheusService>(PrometheusService);
		fetchService = module.get(FetchService);
	});

	it('should be defined', () => {
		expect(prometheusService).toBeDefined();
	});

	it('scrapes and parses metrics from the given url', async () => {
		const text = jest.fn().mockResolvedValue('# TYPE cdk_errors_total counter\ncdk_errors_total 2\n');
		fetchService.fetchWithProxy.mockResolvedValue({ok: true, text} as any);
		const families = await prometheusService.scrapeMetrics('http://mint:5553/metrics');
		expect(fetchService.fetchWithProxy).toHaveBeenCalledWith(
			'http://mint:5553/metrics',
			expect.objectContaining({method: 'GET', signal: expect.any(AbortSignal)}),
		);
		expect(families).toEqual([{name: 'cdk_errors_total', type: 'counter', samples: [{labels: {}, value: 2}]}]);
	});

	it('bounds the scrape with a 15s abort timeout so a hung endpoint cannot pend forever', async () => {
		const timeout_spy = jest.spyOn(AbortSignal, 'timeout');
		const text = jest.fn().mockResolvedValue('');
		fetchService.fetchWithProxy.mockResolvedValue({ok: true, text} as any);
		await prometheusService.scrapeMetrics('http://mint:5553/metrics');
		expect(timeout_spy).toHaveBeenCalledWith(15000);
		timeout_spy.mockRestore();
	});

	it('throws on non-ok responses', async () => {
		fetchService.fetchWithProxy.mockResolvedValue({ok: false, status: 503} as any);
		await expect(prometheusService.scrapeMetrics('http://mint:5553/metrics')).rejects.toThrow('Prometheus endpoint returned 503');
	});

	it('propagates fetch rejections', async () => {
		fetchService.fetchWithProxy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
		await expect(prometheusService.scrapeMetrics('http://mint:5553/metrics')).rejects.toThrow('ECONNREFUSED');
	});
});
