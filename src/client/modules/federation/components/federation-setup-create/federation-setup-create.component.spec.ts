import {TestBed} from '@angular/core/testing';
import {DateTime} from 'luxon';
import {FederationSetupCreateComponent} from './federation-setup-create.component';
describe('FederationSetupCreateComponent', () => {
	it('uses the keyset datepicker, labelled stepper groups and pressed network choices', () => {
		const fixture = TestBed.createComponent(FederationSetupCreateComponent);
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelector('mat-datepicker-toggle')).not.toBeNull();
		expect(element.textContent).toContain('Leave blank for no expiry');
		for (const group of Array.from(element.querySelectorAll<HTMLElement>('.stepper[role="group"]'))) {
			expect(element.querySelector('#' + group.getAttribute('aria-labelledby'))).not.toBeNull();
		}
		const pressed: HTMLButtonElement[] = Array.from(element.querySelectorAll('button[aria-pressed="true"]'));
		expect(pressed.map((button) => button.textContent?.trim())).toEqual([jasmine.stringContaining('Signet'), '24 hours']);
		expect(element.textContent).toContain('Mainnet');
	});
	it('previews the first keyset and submits from the summary card', async () => {
		const fixture = TestBed.createComponent(FederationSetupCreateComponent);
		const emitted = jasmine.createSpy();
		fixture.componentInstance.create.subscribe(emitted);
		fixture.detectChanges();
		await fixture.whenStable();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelectorAll('mat-chip-row').length).toBe(8);
		expect(element.querySelector('.keyset-preview')?.textContent).toContain('Gen 1');
		expect(element.querySelector('.keyset-preview')?.textContent).toContain('8 amounts, 1 to 128');
		expect(element.querySelector('aside .setup-list')?.textContent).toContain('sat · 1 to 128 · no fee');
		element.querySelector<HTMLButtonElement>('aside button[type="submit"]')!.click();
		expect(emitted).toHaveBeenCalledTimes(1);
		expect(emitted.calls.mostRecent().args[0].invitation_lifetime_secs).toBe('86400');
	});
	it('sends the end of the chosen day as whole Unix seconds and no expiry when blank', () => {
		const component = TestBed.createComponent(FederationSetupCreateComponent).componentInstance;
		const emitted = jasmine.createSpy();
		component.create.subscribe(emitted);
		component.submit();
		expect(emitted.calls.mostRecent().args[0].keyset.final_expiry).toBeUndefined();
		const date = DateTime.fromISO('2027-05-03');
		component.expiry.set(date);
		component.submit();
		expect(emitted.calls.mostRecent().args[0].keyset.final_expiry).toBe(String(date.endOf('day').toUnixInteger()));
	});
	it('keeps every threshold inside cdk’s range and resets both when the member count changes', () => {
		const component = TestBed.createComponent(FederationSetupCreateComponent).componentInstance;
		expect([component.threshold(), component.rules().consensus, component.payment_checks()]).toEqual([3, 4, 4]);
		component.changeSigning(5);
		component.changePayment(5);
		expect([component.threshold(), component.payment_checks()]).toEqual([4, 5]);
		component.changePayment(-5);
		expect(component.payment_checks()).toBe(4);
		expect(component.customised()).toBeTrue();
		component.changeMembers(2);
		expect([component.members(), component.threshold(), component.rules().consensus, component.payment_checks()]).toEqual([7, 4, 5, 5]);
		expect(component.customised()).toBeFalse();
		component.changeMembers(-10);
		expect([component.members(), component.threshold(), component.payment_checks()]).toEqual([2, 2, 2]);
		expect(component.signing_range()).toBe('Fixed at 2');
		expect(component.payment_range()).toBe('Fixed at 2');
	});
	it('words the offline tolerance for none, one and several members', () => {
		const component = TestBed.createComponent(FederationSetupCreateComponent).componentInstance;
		expect(component.offline_copy()).toContain('up to 1 member offline');
		component.changeMembers(2);
		expect(component.offline_copy()).toContain('up to 2 members offline');
		component.changePayment(2);
		expect(component.offline_copy()).toBe('Every member must stay online for the federation to run.');
	});
	it('keeps powers of two editable once unticked, and emits exact uint64 strings', () => {
		const fixture = TestBed.createComponent(FederationSetupCreateComponent);
		const component = fixture.componentInstance;
		const emitted = jasmine.createSpy();
		component.create.subscribe(emitted);
		component.amount_count.set(64);
		component.setDefaultAmounts(false);
		component.removeAmount('1');
		component.addAmount({value: '3, 0, x', chipInput: {clear: () => undefined}} as never);
		component.submit();
		const sent = emitted.calls.mostRecent().args[0];
		expect(sent.keyset.amounts.length).toBe(64);
		expect(sent.keyset.amounts).toContain('9223372036854775808');
		expect(sent.keyset.amounts.at(-1)).toBe('3');
		expect(sent.public_mint_url).toBeUndefined();
	});
	it('holds without amounts or while busy', () => {
		const fixture = TestBed.createComponent(FederationSetupCreateComponent);
		const component = fixture.componentInstance;
		const emitted = jasmine.createSpy();
		component.create.subscribe(emitted);
		component.setDefaultAmounts(false);
		component.amounts().forEach((amount) => component.removeAmount(amount));
		component.submit();
		expect(emitted).not.toHaveBeenCalled();
		component.setDefaultAmounts(true);
		fixture.componentRef.setInput('busy', true);
		component.submit();
		expect(emitted).not.toHaveBeenCalled();
	});
});
