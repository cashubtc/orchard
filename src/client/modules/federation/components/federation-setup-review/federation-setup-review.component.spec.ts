import {TestBed} from '@angular/core/testing';
import {setupProposal} from '@client/modules/federation/helpers/federation-setup.fixtures';
import {paymentRule} from '@client/modules/federation/helpers/federation-status.helpers';
import {FederationSetupReviewComponent} from './federation-setup-review.component';
describe('FederationSetupReviewComponent', () => {
	it('requires only the other operators and emits the displayed hash', () => {
		const fixture = TestBed.createComponent(FederationSetupReviewComponent);
		const component = fixture.componentInstance;
		fixture.componentRef.setInput('proposal', setupProposal());
		fixture.componentRef.setInput('member_id', 1);
		const emitted = jasmine.createSpy();
		component.approve.subscribe(emitted);
		component.setChecked(2, true);
		component.submit();
		expect(emitted).not.toHaveBeenCalled();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('fingerprint-1');
		expect(fixture.nativeElement.querySelectorAll('mat-checkbox').length).toBe(2);
		component.setChecked(3, true);
		component.submit();
		expect(emitted).toHaveBeenCalledOnceWith('hash');
		fixture.componentRef.setInput('approved_members', [1]);
		expect(component.ready()).toBeFalse();
	});
	it('words the payment rule as the dashboard does and shows Never for a keyset without expiry', () => {
		const fixture = TestBed.createComponent(FederationSetupReviewComponent);
		const policy = {type: 'member_quorum', required: 3};
		const details_json = JSON.stringify({payment_observation_policy: {mint_quotes: policy, melt_quotes: policy}});
		fixture.componentRef.setInput('proposal', {...setupProposal(), details_json});
		fixture.detectChanges();
		const text: string = fixture.nativeElement.textContent;
		expect(text).toContain(paymentRule({kind: 'PAYMENT_VERIFICATION_POLICY_KIND_MEMBER_QUORUM', required_observations: 3}));
		expect(text).toContain('Expiry: Never');
	});
	it('displays the original proposal JSON without rounding uint64 numbers', () => {
		const fixture = TestBed.createComponent(FederationSetupReviewComponent);
		const details_json = '{"amounts":[18446744073709551615]}';
		fixture.componentRef.setInput('proposal', {...setupProposal(), details_json});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('pre').textContent).toContain(details_json);
	});
	it('invalidates confirmations when the proposal or an identity changes', () => {
		const fixture = TestBed.createComponent(FederationSetupReviewComponent);
		const component = fixture.componentInstance;
		fixture.componentRef.setInput('proposal', setupProposal());
		[1, 2, 3].forEach((id) => component.setChecked(id, true));
		expect(component.ready()).toBeTrue();
		fixture.componentRef.setInput('proposal', {...setupProposal(), proposal_hash: 'changed'});
		expect(component.checked_count()).toBe(0);
	});
});
