/* Local Dependencies */
import {getUnitMeta, toDisplayAmount} from './unit.helpers';

describe('UnitHelpers', () => {
	describe('getUnitMeta', () => {
		it('should describe sat as a whole-number bitcoin unit', () => {
			expect(getUnitMeta('sat')).toEqual({code: 'sat', decimals: 0, divisor: 1, family: 'btc', glyph: '₿'});
		});

		it('should describe usd as a two-decimal fiat unit stored in cents', () => {
			expect(getUnitMeta('usd')).toEqual({code: 'USD', decimals: 2, divisor: 100, family: 'fiat', glyph: '$'});
		});

		it('should be case insensitive', () => {
			expect(getUnitMeta('USD').code).toBe('USD');
		});

		it('should treat an unknown unit as a whole-number custom unit named by its slug', () => {
			expect(getUnitMeta('ora')).toEqual({code: 'ora', decimals: 0, divisor: 1, family: 'custom'});
		});

		it('should give an unknown unit no glyph', () => {
			expect(getUnitMeta('ora').glyph).toBeUndefined();
		});
	});

	describe('toDisplayAmount', () => {
		it('should pass sat through unchanged', () => {
			expect(toDisplayAmount('sat', 123456)).toBe(123456);
		});

		it('should round msat up to whole sat', () => {
			expect(toDisplayAmount('msat', 1000)).toBe(1);
			expect(toDisplayAmount('msat', 1500)).toBe(2);
		});

		it('should convert fiat minor units to major units', () => {
			expect(toDisplayAmount('usd', 215)).toBe(2.15);
			expect(toDisplayAmount('eur', 0)).toBe(0);
		});

		it('should pass a custom unit through unchanged', () => {
			expect(toDisplayAmount('ora', 3776)).toBe(3776);
		});
	});
});
