import {TestBed} from '@angular/core/testing';
import {FederationSetupJoinComponent} from './federation-setup-join.component';
describe('FederationSetupJoinComponent', () => {
	it('requires an invitation and emits only supplied URLs', () => {
		const component = TestBed.createComponent(FederationSetupJoinComponent).componentInstance;
		const emitted = jasmine.createSpy();
		component.join.subscribe(emitted);
		component.submit();
		expect(emitted).not.toHaveBeenCalled();
		component.invitation.set('  secret  ');
		component.submit();
		expect(emitted).toHaveBeenCalledWith({
			invitation: 'secret',
			allow_insecure_localhost: false,
			public_mint_url: undefined,
			federation_api_url: undefined,
		});
	});
	it('loads a text invitation locally and clears the file input', async () => {
		const component = TestBed.createComponent(FederationSetupJoinComponent).componentInstance;
		const input = {files: [new File(['  secret\n'], 'member.invite')], value: 'member.invite'};
		await component.openFile({target: input} as unknown as Event);
		expect(component.invitation()).toBe('secret');
		expect(input.value).toBe('');
		expect(component.reading()).toBeFalse();
	});
	it('rejects oversized files without replacing the invitation', async () => {
		const component = TestBed.createComponent(FederationSetupJoinComponent).componentInstance;
		const input = {files: [new File([new Uint8Array(1000001)], 'large.invite')], value: 'large.invite'};
		await component.openFile({target: input} as unknown as Event);
		expect(component.invitation()).toBe('');
		expect(component.file_error()).toContain('too large');
	});
});
