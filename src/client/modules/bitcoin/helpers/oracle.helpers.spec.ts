/* Local Dependencies */
import {oracleConvertToUSDCents} from './oracle.helpers';

describe('oracle.helpers', () => {
	describe('oracleConvertToUSDCents', () => {
		it('converts each bitcoin unit from its minor unit at the price', () => {
			expect(oracleConvertToUSDCents(50000, 100_000, 'sat')).toBe(5000);
			expect(oracleConvertToUSDCents(50000, 100_000, 'btc')).toBe(5000);
			expect(oracleConvertToUSDCents(50_000_000, 100_000, 'msat')).toBe(5000);
		});

		it('has nothing to convert without an amount, a price or a bitcoin unit', () => {
			expect(oracleConvertToUSDCents(null, 100_000, 'sat')).toBeNull();
			expect(oracleConvertToUSDCents(50000, null, 'sat')).toBeNull();
			expect(oracleConvertToUSDCents(50000, 100_000, 'usd')).toBeNull();
		});
	});
});
