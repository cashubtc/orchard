/* Core Dependencies */
import {FormControl, FormRecord} from '@angular/forms';
/* Native Dependencies */
import {
	SERVICE_DEFAULT_PORTS,
	SERVICE_DESCRIPTORS,
	SERVICE_FIELDS,
} from '@client/modules/service-config/constants/service-config.constants';
import type {ServiceForm, ServiceField} from '@client/modules/service-config/types/service-config.types';
/* Shared Dependencies */
import type {OrchardServiceConfiguration, ServiceConnectionInput, ServiceKind} from '@shared/generated.types';

/** Build a reusable form without copying masked values into credential controls. */
export function createServiceForm(configuration: OrchardServiceConfiguration): ServiceForm {
	const form = new FormRecord<FormControl<string>>({});
	for (const field of configuration.fields) form.addControl(field.key, new FormControl(field.value ?? '', {nonNullable: true}));
	if (!form.controls['type'].value) form.controls['type'].setValue(SERVICE_DESCRIPTORS[configuration.service].types[0].value);
	if (form.controls['mtls'] && !form.controls['mtls'].value) form.controls['mtls'].setValue('false');
	if (!form.controls['host'].value) form.controls['host'].setValue('127.0.0.1');
	if (!form.controls['port'].value) form.controls['port'].setValue(SERVICE_DEFAULT_PORTS[form.controls['type'].value]);
	return form;
}

/** Omitted credentials mean keep the effective stored value; a dirty blank explicitly clears it. */
export function serviceFormInput(configuration: OrchardServiceConfiguration, form: ServiceForm): ServiceConnectionInput {
	return {
		service: configuration.service,
		values: configuration.fields
			.filter((field) => !(field.secret && field.set && !form.controls[field.key].dirty))
			.map((field) => ({key: field.key, value: form.controls[field.key].value})),
	};
}

/** Select the fields for each implementation without coupling the form to Settings. */
export function visibleServiceFields(service: ServiceKind, type: string, mtls: string): ServiceField[] {
	const keys = ['host', 'port'];
	if (service === 'bitcoin') keys.push('user', 'password');
	if (service === 'lightning') keys.push(...(type === 'lnd' ? ['macaroon', 'cert'] : ['ca', 'cert', 'key']));
	if (service === 'mint') {
		if (mtls === 'true') keys.push('ca', 'cert', 'key');
		keys.push('database', 'api');
	}
	return SERVICE_FIELDS.filter((field) => keys.includes(field.key));
}
