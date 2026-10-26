import {ServiceKind} from '@shared/generated.types';
import {TestBed} from '@angular/core/testing';
import {ServiceFieldsComponent} from './service-fields.component';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {createServiceForm, serviceFormInput} from '@client/modules/service-config/helpers/service-config.helpers';

describe('ServiceFieldsComponent', () => {
	it('shows credential presence without submitting a mask, and permits explicit clearing', () => {
		const fixture = TestBed.createComponent(ServiceFieldsComponent);
		const configuration = bitcoinConfiguration();
		const form = createServiceForm(configuration);
		fixture.componentRef.setInput('configuration', configuration);
		fixture.componentRef.setInput('form', form);
		fixture.componentRef.setInput('flagged', ['host']);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('input[type="password"]').placeholder).toContain('unchanged');
		expect(fixture.nativeElement.querySelector('[aria-invalid="true"]')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('input[type="password"]').autocomplete).toBe('new-password');
		const plain: HTMLInputElement[] = Array.from(fixture.nativeElement.querySelectorAll('input:not([type="password"])'));
		expect(plain.length).toBe(3);
		expect(plain.every((input) => input.autocomplete === 'off')).toBeTrue();
		expect(fixture.nativeElement.textContent).toContain('The password is stored encrypted.');
		expect(serviceFormInput(configuration, form).values.some((field) => field.key === 'password')).toBeFalse();
		fixture.componentInstance.clearField('password');
		expect(serviceFormInput(configuration, form).values.find((field) => field.key === 'password')?.value).toBe('');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('input[type="password"]').placeholder).not.toContain('unchanged');
		expect(fixture.nativeElement.textContent).toContain('Cleared. Saving removes it.');
		expect(fixture.nativeElement.textContent).not.toContain('Leave unchanged to keep it.');
	});

	it('recomputes transport fields and puts credential help after visible credentials only', () => {
		const configuration = {...bitcoinConfiguration(), service: ServiceKind.Mint, type: 'cdk'};
		configuration.fields = ['type', 'host', 'port', 'mtls', 'ca', 'cert', 'key', 'database', 'api'].map((key) => ({
			key,
			value: key === 'type' ? 'cdk' : key === 'mtls' ? 'false' : '',
			secret: false,
			set: false,
		}));
		const form = createServiceForm(configuration);
		const fixture = TestBed.createComponent(ServiceFieldsComponent);
		fixture.componentRef.setInput('configuration', configuration);
		fixture.componentRef.setInput('form', form);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('textarea').length).toBe(0);
		expect(fixture.nativeElement.textContent).not.toContain('Paste a PEM');
		expect(fixture.nativeElement.textContent.match(/optional/g)?.length).toBe(1);
		form.controls['mtls'].setValue('true');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('textarea').length).toBe(3);
		expect(fixture.nativeElement.textContent).toContain('Paste a PEM');
		const children: HTMLElement[] = Array.from(fixture.nativeElement.querySelector('.service-fields').children);
		const help_index = children.findIndex((element) => element.tagName === 'ORC-FORM-HELP-TEXT');
		expect(children[help_index - 1].textContent).toContain('Client key');
		form.controls['mtls'].setValue('false');
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).not.toContain('Paste a PEM');
	});
});
