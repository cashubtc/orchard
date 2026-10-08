/* Local Dependencies */
import {compareUnits, fromDisplayAmountFor, getUnitMeta, toDisplayAmount, toSats} from './unit.helpers';

describe('UnitHelpers', () => {
	describe('getUnitMeta', () => {
		it('should describe sat as a whole-number bitcoin unit', () => {
			expect(getUnitMeta('sat')).toEqual({
				code: 'sat',
				decimals: 0,
				divisor: 1,
				family: 'btc',
				asset: 'btc',
				icon: 'currency_bitcoin',
				glyph: '₿',
			});
		});

		it('should describe usd as a two-decimal fiat unit stored in cents', () => {
			expect(getUnitMeta('usd')).toEqual({
				code: 'USD',
				decimals: 2,
				divisor: 100,
				family: 'fiat',
				asset: 'usd',
				icon: 'attach_money',
				glyph: '$',
			});
		});

		it('should be case insensitive', () => {
			expect(getUnitMeta('USD').code).toBe('USD');
		});

		it('should treat an unknown unit as a whole-number custom unit named by its slug', () => {
			expect(getUnitMeta('ora')).toEqual({
				code: 'ora',
				decimals: 0,
				divisor: 1,
				family: 'custom',
				asset: 'custom',
				icon: 'money_bag',
			});
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

		it('should convert btc, held in sats, to whole BTC', () => {
			expect(toDisplayAmount('btc', 100_000_000)).toBe(1);
			expect(toDisplayAmount('btc', 12345)).toBe(0.00012345);
		});
	});

	describe('fromDisplayAmountFor', () => {
		it('should convert display amounts back to whole base units', () => {
			expect(fromDisplayAmountFor(getUnitMeta('sat'), 2100)).toBe(2100);
			expect(fromDisplayAmountFor(getUnitMeta('msat'), 2)).toBe(2000);
			expect(fromDisplayAmountFor(getUnitMeta('btc'), 0.00012345)).toBe(12345);
			expect(fromDisplayAmountFor(getUnitMeta('usd'), 2.15)).toBe(215);
		});

		it('should pass a custom unit through unchanged', () => {
			expect(toDisplayAmount('ora', 3776)).toBe(3776);
		});
	});

	describe('toSats', () => {
		it('should convert each bitcoin unit to whole sats, rounding msat up', () => {
			expect(toSats('sat', 2100)).toBe(2100);
			expect(toSats('MSAT', 1500)).toBe(2);
			expect(toSats('btc', 50000)).toBe(50000);
		});

		it('should have no sats for fiat or custom units', () => {
			expect(toSats('usd', 100)).toBeNull();
			expect(toSats('ora', 100)).toBeNull();
		});
	});

	describe('compareUnits', () => {
		it('should sort bitcoin units before fiat, and fiat before custom', () => {
			expect(['ora', 'usd', 'sat', 'eur', 'msat'].sort(compareUnits)).toEqual(['msat', 'sat', 'eur', 'usd', 'ora']);
		});
	});
});
