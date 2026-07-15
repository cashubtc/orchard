/* Native Dependencies */
import {computeHttpErrorRate, computeEndpointDistribution} from './mint-http-metric.helpers';
import {MintMetric} from '@client/modules/mint/classes/mint-metric.class';

const metric = (endpoint: string, status: string, value: number): MintMetric =>
	({
		metric: 'cdk_http_requests_total',
		labels: [
			{name: 'endpoint', value: endpoint},
			{name: 'status', value: status},
		],
		type: 'counter',
		date: 0,
		value,
	}) as unknown as MintMetric;

describe('mint-http-metric.helpers', () => {
	describe('computeHttpErrorRate', () => {
		it('returns the percent of 4xx/5xx responses', () => {
			expect(computeHttpErrorRate([metric('/mint', '200', 80), metric('/mint', '500', 20)])).toBe(20);
		});

		it('treats 1xx/2xx/3xx (incl. websocket 101 upgrades) as success', () => {
			expect(computeHttpErrorRate([metric('/info', '200', 90), metric('/ws', '101', 129), metric('/keys', '304', 10)])).toBe(0);
		});

		it('counts client and server errors together', () => {
			expect(computeHttpErrorRate([metric('/mint', '200', 96), metric('/mint', '404', 3), metric('/mint', '503', 1)])).toBe(4);
		});

		it('returns null when there were no requests', () => {
			expect(computeHttpErrorRate([])).toBeNull();
		});
	});

	describe('computeEndpointDistribution', () => {
		it('sums totals per endpoint descending, dropping zeroes', () => {
			const distribution = computeEndpointDistribution([
				metric('/mint', '200', 3),
				metric('/melt', '200', 6),
				metric('/mint', '500', 2),
				metric('/swap', '200', 0),
			]);
			expect(distribution).toEqual([
				{label: '/melt', value: 6},
				{label: '/mint', value: 5},
			]);
		});
	});
});
