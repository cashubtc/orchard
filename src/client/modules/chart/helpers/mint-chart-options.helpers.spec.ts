/* Local Dependencies */
import {getYAxis, getUnitYAxisConfig} from './mint-chart-options.helpers';

describe('MintChartOptionsHelpers', () => {
	describe('getYAxis', () => {
		it('should return one btc axis for bitcoin units', () => {
			expect(getYAxis(['sat', 'msat'])).toEqual(['ybtc']);
		});

		it('should return one fiat axis for fiat units', () => {
			expect(getYAxis(['usd', 'eur'])).toEqual(['yfiat']);
		});

		it('should return a single custom axis for a custom-only unit set', () => {
			expect(getYAxis(['ora'])).toEqual(['ycustom']);
			expect(getYAxis(['ora', 'branch'])).toEqual(['ycustom']);
		});

		it('should return one axis per family present', () => {
			expect(getYAxis(['sat', 'usd', 'ora'])).toEqual(['ybtc', 'yfiat', 'ycustom']);
		});

		it('should ignore undefined labels', () => {
			expect(getYAxis([undefined, 'sat'])).toEqual(['ybtc']);
		});
	});

	describe('axis labels', () => {
		it('should label the fiat axis with the codes present', () => {
			expect(getUnitYAxisConfig({family: 'fiat', units: ['usd'], show_grid: true, grid_color: '#000'}).title.text).toBe('USD');
			expect(getUnitYAxisConfig({family: 'fiat', units: ['usd', 'eur'], show_grid: true, grid_color: '#000'}).title.text).toBe(
				'USD / EUR',
			);
		});

		it('should label the custom axis with the mint own unit codes', () => {
			expect(getUnitYAxisConfig({family: 'custom', units: ['ora'], show_grid: true, grid_color: '#000'}).title.text).toBe('ora');
			expect(getUnitYAxisConfig({family: 'custom', units: ['ora', 'branch'], show_grid: true, grid_color: '#000'}).title.text).toBe(
				'ora / branch',
			);
		});

		it('should not repeat a code that appears twice', () => {
			expect(getUnitYAxisConfig({family: 'custom', units: ['ora', 'ora'], show_grid: true, grid_color: '#000'}).title.text).toBe(
				'ora',
			);
		});
	});
});
