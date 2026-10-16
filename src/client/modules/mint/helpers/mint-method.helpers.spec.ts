/* Shared Dependencies */
import {OrchardNuts} from '@shared/generated.types';
/* Local Dependencies */
import {getMintMethods} from './mint-method.helpers';

describe('getMintMethods', () => {
	it('lists each method the mint mints or melts with once, minting first', () => {
		const nuts = {
			nut4: {
				disabled: false,
				methods: [
					{method: 'bolt11', unit: 'sat'},
					{method: 'onchain', unit: 'sat'},
					{method: 'bolt11', unit: 'usd'},
				],
			},
			nut5: {
				disabled: false,
				methods: [
					{method: 'bolt12', unit: 'sat'},
					{method: 'bolt11', unit: 'sat'},
				],
			},
		} as OrchardNuts;
		expect(getMintMethods(nuts)).toEqual(['bolt11', 'onchain', 'bolt12']);
	});
});
