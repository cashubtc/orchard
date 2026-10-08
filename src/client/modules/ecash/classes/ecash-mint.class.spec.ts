/* Shared Dependencies */
import {OrchardNut4} from '@shared/generated.types';
/* Local Dependencies */
import {EcashMint} from './ecash-mint.class';

describe('EcashMint', () => {
	const withNut4 = (nut4: OrchardNut4 | null) =>
		new EcashMint({
			id: 'mint-1',
			urls: ['https://mint.orchard.example:3338'],
			is_orchard: true,
			created_at: 0,
			info: nut4 ? {nuts: {nut4, nut5: {disabled: false, methods: []}}} : null,
		});

	it('falls back to its host while it has no info', () => {
		const mint = withNut4(null);
		expect(mint.display_name).toBe('mint.orchard.example:3338');
		expect(mint.icon_url).toBeNull();
	});

	it('issues over bolt11 only, in each unit once, carrying the limits', () => {
		const mint = withNut4({
			disabled: false,
			methods: [
				{method: 'bolt11', unit: 'sat', min_amount: 1, max_amount: 500000},
				{method: 'bolt12', unit: 'sat'},
				{method: 'bolt12', unit: 'eur'},
				{method: 'bolt11', unit: 'usd'},
			],
		});
		expect(mint.issue_units).toEqual(['sat', 'usd']);
		expect(mint.getIssueMethod('sat')).toEqual(jasmine.objectContaining({min_amount: 1, max_amount: 500000}));
		expect(mint.getIssueMethod('eur')).toBeNull();
		expect(mint.issue_blocked).toBeNull();
	});

	it("explains why it can't issue, per its NUT-04 settings", () => {
		expect(withNut4(null).issue_blocked).toBe("Waiting for your mint's info");
		expect(withNut4({disabled: true, methods: [{method: 'bolt11', unit: 'sat'}]}).issue_blocked).toBe(
			'Minting is disabled on your mint',
		);
		expect(withNut4({disabled: false, methods: [{method: 'bolt12', unit: 'sat'}]}).issue_blocked).toBe(
			'Your mint offers no Lightning minting',
		);
	});
});
