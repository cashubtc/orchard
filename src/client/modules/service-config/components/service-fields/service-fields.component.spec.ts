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
		expect(serviceFormInput(configuration, form).values.some((field) => field.key === 'password')).toBeFalse();
		fixture.componentInstance.clearField('password');
		expect(serviceFormInput(configuration, form).values.find((field) => field.key === 'password')?.value).toBe('');
	});
});
