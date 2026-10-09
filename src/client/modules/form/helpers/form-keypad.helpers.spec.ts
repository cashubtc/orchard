/* Local Dependencies */
import {applyKeypadKey} from './form-keypad.helpers';

describe('form-keypad.helpers', () => {
	describe('applyKeypadKey', () => {
		const type = (keys: string[], decimals: number) => keys.reduce((text, key) => applyKeypadKey(text, key, decimals), '');

		it('builds whole amounts, ignoring a leading zero and the decimal point', () => {
			expect(type(['0', '2', '1'], 0)).toBe('21');
			expect(type(['2', '.', '5'], 0)).toBe('25');
		});

		it("takes one decimal point and fraction digits up to the unit's precision", () => {
			expect(type(['1', '2', '.', '5', '0', '9'], 2)).toBe('12.50');
			expect(type(['.', '.', '5'], 2)).toBe('0.5');
		});

		it('drops the last character on backspace', () => {
			expect(type(['1', '2', '.', 'backspace', 'backspace'], 2)).toBe('1');
			expect(type(['0', '.', 'backspace', '5'], 2)).toBe('5');
		});
	});
});
