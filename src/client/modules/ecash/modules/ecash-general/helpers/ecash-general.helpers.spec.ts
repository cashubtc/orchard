/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
/* Local Dependencies */
import {buildUnitChips} from './ecash-general.helpers';

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
