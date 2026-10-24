import {TestBed} from '@angular/core/testing';
import {setupProposal} from '@client/modules/federation/helpers/federation-setup.fixtures';
import {FederationSetupReviewComponent} from './federation-setup-review.component';
describe('FederationSetupReviewComponent', () => {
	it('requires every fingerprint, including self, and emits the displayed hash', () => {
		const fixture = TestBed.createComponent(FederationSetupReviewComponent);
		const component = fixture.componentInstance;
		fixture.componentRef.setInput('proposal', setupProposal());
		fixture.componentRef.setInput('member_id', 1);
		const emitted = jasmine.createSpy();
		component.approve.subscribe(emitted);
		component.setChecked(2, true);
		component.setChecked(3, true);
		component.submit();
		expect(emitted).not.toHaveBeenCalled();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('fingerprint-1');
		component.setChecked(1, true);
		component.submit();
		expect(emitted).toHaveBeenCalledOnceWith('hash');
		fixture.componentRef.setInput('approved_members', [1]);
		expect(component.ready()).toBeFalse();
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
