/* Local Dependencies */
import {getCashuMethodDisplay} from './cashu.helpers';

describe('getCashuMethodDisplay', () => {
	it('labels and icons known methods, falling back to the mint own name', () => {
		expect(getCashuMethodDisplay('bolt11')).toEqual({label: 'BOLT 11', icon: 'bolt', svg_icon: false});
		expect(getCashuMethodDisplay('bolt12')).toEqual({label: 'BOLT 12', icon: 'double_bolt', svg_icon: true});
		expect(getCashuMethodDisplay('onchain')).toEqual({label: 'ONCHAIN', icon: 'deployed_code', svg_icon: false});
		expect(getCashuMethodDisplay('branch')).toEqual({label: 'BRANCH', icon: 'money_bag', svg_icon: false});
	});
});
