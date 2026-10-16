/* Shared Dependencies */
import {OrchardNuts} from '@shared/generated.types';
/* Local Dependencies */
import {isMintAuthOffered, isNutOffered} from './mint-nut.helpers';

describe('isNutOffered', () => {
	it('offers a NUT the mint lists, even with an empty list, unless its own flag turns it off', () => {
		expect(isNutOffered(undefined)).toBeFalse();
		expect(isNutOffered(null)).toBeFalse();
		expect(isNutOffered({supported: true})).toBeTrue();
		expect(isNutOffered({supported: false})).toBeFalse();
		expect(isNutOffered({supported: []})).toBeTrue();
		expect(isNutOffered({ttl: 60, cached_endpoints: []})).toBeTrue();
		expect(isNutOffered({disabled: true, methods: []})).toBeFalse();
		expect(isNutOffered({disabled: false, methods: []})).toBeTrue();
	});
});

describe('isMintAuthOffered', () => {
	const nuts = {nut4: {disabled: false, methods: []}, nut5: {disabled: false, methods: []}} as OrchardNuts;

	it('reads auth from NUT-21 or NUT-22', () => {
		expect(isMintAuthOffered(nuts)).toBeFalse();
		expect(isMintAuthOffered({...nuts, nut22: {bat_max_mint: 50, protected_endpoints: []}})).toBeTrue();
	});
});
