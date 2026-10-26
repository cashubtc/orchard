import {TestBed} from '@angular/core/testing';
import {bdkWallet, barkWallet, federationInfo} from '@client/modules/federation/helpers/federation-status.fixtures';
import {FederationCustodyComponent} from './federation-custody.component';

describe('FederationCustodyComponent', () => {
	for (const variant of ['none', 'bdk', 'bark', 'both'])
		it(`renders ${variant} custody without inventing absent backends`, () => {
			const fixture = TestBed.createComponent(FederationCustodyComponent);
			const wallet = {...bdkWallet(), utxos: [{state: 'WALLET_UTXO_STATE_SPENDABLE', count: '6', value_sat: '42100000'}]};
			fixture.componentRef.setInput('custody', {
				onchain_wallets: [],
				wallet_operator: ['bdk', 'both'].includes(variant) ? wallet : null,
				bark: ['bark', 'both'].includes(variant) ? barkWallet() : null,
			});
			fixture.detectChanges();
			const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
			expect(text.includes('No funds held')).toBe(variant === 'none');
			expect(fixture.nativeElement.querySelectorAll('[data-testid="federation-custody-off"]').length).toBe(
				variant === 'none' ? 0 : variant === 'both' ? 0 : 1,
			);
			if (variant === 'bdk' || variant === 'both') expect(text).toContain('42,100,000');
			if (variant === 'bark' || variant === 'both') expect(text).toContain('3,410,000');
			expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
		});
	it('names the fake wallet units from the federation keysets', () => {
		const fixture = TestBed.createComponent(FederationCustodyComponent);
		const info = federationInfo();
		info.keysets = ['sat', 'sat', 'usd'].map((unit, index) => ({id: `keyset-${index}`, unit, active: true, input_fee_ppk: '0'}));
		fixture.componentRef.setInput('info', info);
		fixture.componentRef.setInput('custody', {onchain_wallets: []});
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Fake wallet · sat, usd');
	});
	it('does not call missing data an empty wallet and preserves unknown phases', () => {
		const fixture = TestBed.createComponent(FederationCustodyComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).not.toContain('No funds held');
		fixture.componentRef.setInput('custody', {onchain_wallets: [], bark: {...barkWallet(), readiness: 'future_bark_phase'}});
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('future_bark_phase');
		expect(fixture.nativeElement.textContent).toContain('18446744073709551615');
	});
	it('keeps the on-chain slot active if only recovery is reported', () => {
		const fixture = TestBed.createComponent(FederationCustodyComponent);
		fixture.componentRef.setInput('custody', {
			onchain_wallets: [],
			wallet_recovery: {
				address_allocations: '0',
				wallet_utxos: '0',
				sticky_reservations: '2',
				transactions: '1',
				payment_intents: '1',
				actions: [],
			},
		});
		fixture.detectChanges();
		expect(fixture.componentInstance.onchain()).toBeTrue();
		expect(fixture.componentInstance.no_custody()).toBeFalse();
	});
});
