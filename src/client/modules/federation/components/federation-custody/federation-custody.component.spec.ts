import {TestBed} from '@angular/core/testing';
import {bdkWallet, barkWallet} from '@client/modules/federation/helpers/federation-status.fixtures';
import {FederationCustodyComponent} from './federation-custody.component';

describe('FederationCustodyComponent', () => {
	for (const variant of ['none', 'bdk', 'bark', 'both'])
		it(`renders ${variant} custody without inventing absent backends`, () => {
			const fixture = TestBed.createComponent(FederationCustodyComponent);
			fixture.componentRef.setInput('custody', {
				onchain_wallets: [],
				wallet_operator: ['bdk', 'both'].includes(variant) ? bdkWallet() : null,
				bark: ['bark', 'both'].includes(variant) ? barkWallet() : null,
			});
			fixture.detectChanges();
			const text = fixture.nativeElement.textContent;
			expect(text.includes('No funds held')).toBe(variant === 'none');
			expect(fixture.nativeElement.querySelectorAll('.off-card').length).toBe(variant === 'none' ? 2 : variant === 'both' ? 0 : 1);
			if (variant === 'bdk' || variant === 'both') expect(text).toContain('18446744073709551615 sat');
			if (variant === 'bark' || variant === 'both') expect(text).toContain('3410000 sat');
			expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
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
			wallet_recovery: {sticky_reservations: '2', transactions: '1', payment_intents: '1', actions: []},
		});
		fixture.detectChanges();
		expect(fixture.componentInstance.onchain()).toBeTrue();
		expect(fixture.componentInstance.no_custody()).toBeFalse();
	});
});
