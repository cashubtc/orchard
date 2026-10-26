import {ServiceKind, type OrchardServiceConfiguration} from '@shared/generated.types';
import {TestBed, type ComponentFixture} from '@angular/core/testing';
import {ServiceFieldsComponent} from './service-fields.component';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {createServiceForm, serviceFormInput} from '@client/modules/service-config/helpers/service-config.helpers';
import type {ServiceForm} from '@client/modules/service-config/types/service-config.types';

describe('ServiceFieldsComponent', () => {
	it('shows credential presence without submitting a mask, and permits explicit clearing', () => {
		const fixture = TestBed.createComponent(ServiceFieldsComponent);
		const configuration = bitcoinConfiguration();
		const form = createServiceForm(configuration);
		fixture.componentRef.setInput('configuration', configuration);
		fixture.componentRef.setInput('form', form);
		fixture.componentRef.setInput('flagged', ['host']);
		fixture.componentRef.setInput('flag_message', 'Missing RPC host');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('input[type="password"]').placeholder).toContain('unchanged');
		expect(fixture.nativeElement.querySelector('[aria-invalid="true"]')).toBeTruthy();
		// The flagged field explains itself through the form error component
		expect(fixture.nativeElement.querySelector('mat-error orc-form-error').textContent).toContain('Missing RPC host');
		expect(fixture.nativeElement.querySelector('orc-form-toggle-group.orc-segmented')).toBeNull();
		expect(fixture.nativeElement.querySelector('orc-form-toggle').textContent).toContain('JSON-RPC with a user and password');
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

	/** A mint configuration with every field present and the given saved values. */
	function mintConfiguration(saved: Record<string, {value: string | null; secret?: boolean}> = {}): OrchardServiceConfiguration {
		const configuration = {...bitcoinConfiguration(), service: ServiceKind.Mint, type: 'cdk'};
		configuration.fields = ['type', 'host', 'port', 'mtls', 'ca', 'cert', 'key', 'database', 'api', 'metrics'].map((key) => ({
			key,
			value: saved[key]?.value ?? (key === 'type' ? 'cdk' : key === 'mtls' ? 'false' : ''),
			secret: saved[key]?.secret ?? false,
			set: !!saved[key],
		}));
		return configuration;
	}

	/** Render the fields for a configuration and return the fixture with its form. */
	function render(configuration: OrchardServiceConfiguration): {fixture: ComponentFixture<ServiceFieldsComponent>; form: ServiceForm} {
		const form = createServiceForm(configuration);
		const fixture = TestBed.createComponent(ServiceFieldsComponent);
		fixture.componentRef.setInput('configuration', configuration);
		fixture.componentRef.setInput('form', form);
		fixture.detectChanges();
		return {fixture, form};
	}

	it('sections the mint form and puts certificates in full rows under their own heading', () => {
		const {fixture, form} = render(mintConfiguration());
		const headings = (): string[] =>
			Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.field-section h3')).map((h) => h.textContent!);
		expect(headings()).toEqual(['Management RPC', 'Mint data']);
		expect(fixture.nativeElement.querySelectorAll('textarea').length).toBe(0);
		expect(fixture.nativeElement.textContent).not.toContain('Paste each PEM');
		expect(fixture.nativeElement.querySelector('.advanced-fields summary').textContent).toContain('CDK');
		// Connection security is the small, label-only toggle; the implementation keeps its full size
		const small: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('button.form-toggle.small'));
		expect(small.map((toggle) => toggle.textContent!.trim())).toEqual(['Mutual TLS', 'Without mTLS']);
		form.controls['mtls'].setValue('true');
		fixture.detectChanges();
		expect(headings()).toEqual(['Management RPC', 'Mutual TLS certificates', 'Mint data']);
		expect(fixture.nativeElement.querySelector('.field-section p').textContent).toContain('Paste each PEM');
		expect(fixture.nativeElement.querySelector('.field-caption')).toBeNull();
		const files: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('orc-form-field-dynamic:has(textarea)'));
		expect(files.length).toBe(3);
		expect(files.every((file) => file.style.getPropertyValue('--service-field-span') === '12')).toBeTrue();
		form.controls['ca'].setValue('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----');
		fixture.detectChanges();
		expect(files[0].textContent).toContain('PEM · 3 lines');
	});

	it('keeps saved and pasted keys off screen and replaces a saved certificate only once something new is entered', () => {
		const {fixture, form} = render(
			mintConfiguration({mtls: {value: 'true'}, ca: {value: null, secret: true}, cert: {value: '/certs/client.pem'}}),
		);
		const component = fixture.componentInstance;
		const saved = fixture.nativeElement.querySelector('.credential-saved');
		expect(saved.textContent).toContain('CA certificate');
		expect(fixture.nativeElement.querySelectorAll('textarea').length).toBe(2);
		component.replaceField('ca');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.credential-saved')).toBeNull();
		expect(fixture.nativeElement.textContent).toContain('Keep the saved one');
		component.keepField('ca');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.credential-saved')).toBeTruthy();
		expect(form.controls['ca'].dirty).toBeFalse();
		form.controls['key'].setValue('-----BEGIN PRIVATE KEY-----\nSECRET1\nSECRET2\n-----END PRIVATE KEY-----');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.pem-masked').textContent).toContain('2 lines hidden');
		expect(fixture.nativeElement.textContent).not.toContain('SECRET1');
	});

	it('opens field help on demand and drops the metrics URL for a mint that cannot serve it', () => {
		const {fixture, form} = render(mintConfiguration({metrics: {value: 'http://mint:9090'}}));
		const component = fixture.componentInstance;
		expect(fixture.nativeElement.querySelector('.advanced-fields').open).toBeTrue();
		expect(fixture.nativeElement.querySelector('.animation-expanded')).toBeNull();
		component.toggleHelp('database');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.animation-expanded').textContent).toContain('postgres://');
		component.setType('nutshell');
		fixture.detectChanges();
		expect(form.controls['metrics'].value).toBe('');
		expect(fixture.nativeElement.querySelector('.advanced-fields')).toBeNull();
	});
});
