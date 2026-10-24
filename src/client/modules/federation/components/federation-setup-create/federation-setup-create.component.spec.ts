import {TestBed} from '@angular/core/testing';
import {FederationSetupCreateComponent} from './federation-setup-create.component';
describe('FederationSetupCreateComponent', () => {
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
