/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
/* Local Dependencies */
import {buildAmountChars, buildBalanceCells, buildUnitChips, getBalanceCellsWidth} from './ecash-general.helpers';

describe('buildUnitChips', () => {
	it('offers every unit at 0, sums balances across mints, and sorts bitcoin first', () => {
		const balances = [
			new EcashBalance({mint_id: 'a', unit: 'SAT', balance: 100}),
			new EcashBalance({mint_id: 'b', unit: 'sat', balance: 50}),
		];
		expect(buildUnitChips(['usd', 'eur', 'sat'], balances)).toEqual([
			{unit: 'sat', amount: 150},
			{unit: 'eur', amount: 0},
			{unit: 'usd', amount: 0},
		]);
	});

	it('adds units only held, not offered', () => {
		expect(buildUnitChips([], [new EcashBalance({mint_id: 'a', unit: 'usd', balance: 25})])).toEqual([{unit: 'usd', amount: 25}]);
	});
});

describe('buildAmountChars', () => {
	const render = (text: string, decimals: number, locale = 'en-US') =>
		buildAmountChars(text, decimals, locale)
			.map(({char, ghost}) => (ghost ? `(${char})` : char))
			.join('');

	it('shows a ghost zero until something is typed', () => {
		expect(render('', 0)).toBe('(0)');
	});

	it('groups whole amounts the way the locale does', () => {
		expect(render('1000000', 0)).toBe('1,000,000');
		expect(render('1000000', 0, 'de-DE')).toBe('1.000.000');
	});

	it('ghosts the fraction digits still to be typed after the decimal point', () => {
		expect(render('5.', 2)).toBe('5.(0)(0)');
		expect(render('5.2', 2)).toBe('5.2(0)');
		expect(render('1234.50', 2, 'de-DE')).toBe('1.234,50');
	});
});

describe('buildBalanceCells', () => {
	it('gives digits in any script a full cell and separators a narrow one', () => {
		const widths = (text: string) => buildBalanceCells(text).map((cell) => cell.width);
		expect(widths('2,100')).toEqual([0.665, 0.24, 0.665, 0.665, 0.665]);
		expect(widths('١٬٢٣')).toEqual([0.665, 0.24, 0.665, 0.665]);
		expect(getBalanceCellsWidth(buildBalanceCells('1.5'))).toBeCloseTo(1.57);
	});
});
