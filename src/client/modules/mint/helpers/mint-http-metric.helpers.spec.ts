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
		it('returns the percent of non-200 responses', () => {
			expect(computeHttpErrorRate([metric('/mint', '200', 80), metric('/mint', '500', 20)])).toBe(20);
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
