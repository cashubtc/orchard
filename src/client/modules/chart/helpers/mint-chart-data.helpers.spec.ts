/* Local Dependencies */
import {convertChartDataWithOracle} from './mint-chart-data.helpers';

describe('mint-chart-data.helpers', () => {
	describe('convertChartDataWithOracle', () => {
		const oracle_map = new Map([[0, 100_000]]);
		const convert = (y: number, unit: string) => convertChartDataWithOracle([{x: 0, y}], unit, oracle_map, true)[0];

		it('converts display amounts of each bitcoin unit at the price, keeping the original', () => {
			expect(convert(50000, 'sat')).toEqual(jasmine.objectContaining({y: 5000, y_original: 50000, y_converted: 5000}));
			expect(convert(50000, 'msat').y_converted).toBe(5000);
			expect(convert(0.0005, 'btc').y_converted).toBe(5000);
		});

		it('leaves units the oracle cannot price as they are', () => {
			expect(convert(1.61, 'usd')).toEqual(jasmine.objectContaining({y: 1.61, y_converted: null}));
		});
	});
});
