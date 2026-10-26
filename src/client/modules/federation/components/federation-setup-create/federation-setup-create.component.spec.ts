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
		const pressed = element.querySelector('button[aria-pressed="true"]');
		expect(pressed?.textContent).toContain('Signet');
		expect(element.querySelectorAll('orc-form-toggle[aria-pressed]').length).toBe(0);
	});
	it('shows denominations as chips until edited, summarizes the keyset and submits from the summary card', async () => {
		const fixture = TestBed.createComponent(FederationSetupCreateComponent);
		const emitted = jasmine.createSpy();
		fixture.componentInstance.create.subscribe(emitted);
		fixture.detectChanges();
		await fixture.whenStable();
		const element: HTMLElement = fixture.nativeElement;
		expect(element.querySelectorAll('.amount-chip:not(.amount-edit)').length).toBe(8);
		expect(element.querySelector('.summary-list')?.textContent).toContain('sat · 1 to 128 · no fee');
		element.querySelector<HTMLButtonElement>('.amount-edit')!.click();
		fixture.detectChanges();
		expect(element.querySelector('input[name="amounts"]')).not.toBeNull();
		await fixture.whenStable();
		fixture.detectChanges();
		element.querySelector<HTMLButtonElement>('aside button[type="submit"]')!.click();
		expect(emitted).toHaveBeenCalledTimes(1);
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
	it('words the offline tolerance for none, one and several members', () => {
		const component = TestBed.createComponent(FederationSetupCreateComponent).componentInstance;
		expect(component.offline_copy()).toContain('up to 1 member offline');
		component.changeMembers(2);
		expect(component.offline_copy()).toContain('up to 2 members offline');
		component.threshold.set(component.members());
		expect(component.offline_copy()).toBe('Every member must stay online.');
	});
	it('derives quorum and clamps signing when member count shrinks', () => {
		const component = TestBed.createComponent(FederationSetupCreateComponent).componentInstance;
		expect(component.consensus()).toBe(4);
		expect(component.payment_checks()).toBe(4);
		component.changeMembers(-3);
		expect(component.members()).toBe(2);
		expect(component.threshold()).toBe(2);
		expect(component.consensus()).toBe(2);
	});
	it('emits exact uint64 strings, leaves blank URLs to the mint, and holds while busy', () => {
		const fixture = TestBed.createComponent(FederationSetupCreateComponent);
		const component = fixture.componentInstance;
		const emitted = jasmine.createSpy();
		component.create.subscribe(emitted);
		component.amounts_text.set('1, 9007199254740993');
		component.submit();
		const sent = emitted.calls.mostRecent().args[0];
		expect(sent.keyset.amounts).toEqual(['1', '9007199254740993']);
		expect(sent.public_mint_url).toBeUndefined();
		component.amounts_text.set('');
		component.submit();
		expect(emitted).toHaveBeenCalledTimes(1);
		component.amounts_text.set('1');
		fixture.componentRef.setInput('busy', true);
		component.submit();
		expect(emitted).toHaveBeenCalledTimes(1);
	});
});
