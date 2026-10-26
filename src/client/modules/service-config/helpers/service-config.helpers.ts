/* Core Dependencies */
import {FormControl, FormRecord} from '@angular/forms';
/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {
	SERVICE_DEFAULT_PORTS,
	SERVICE_DESCRIPTORS,
	SERVICE_FIELDS,
	SERVICE_MODE_LABELS,
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

/** The effective configuration after a save: the submitted non-secret values, with secrets kept as presence flags. */
export function serviceAppliedConfiguration(configuration: OrchardServiceConfiguration, form: ServiceForm): OrchardServiceConfiguration {
	return {
		...configuration,
		enabled: true,
		source: 'orchard',
		fields: configuration.fields.map((field) => (field.secret ? field : {...field, value: form.controls[field.key].value})),
	};
}

/** Keep the server's diagnostic and code in a failure message, since operators paste it into issues. */
export function serviceErrorMessage(error: unknown, fallback: string): string {
	const orchard_error = error instanceof OrchardErrors ? error.errors[0] : undefined;
	if (!orchard_error) return fallback;
	return `${fallback} ${orchard_error.details || orchard_error.message} (${orchard_error.code})`;
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

/** Show an effective RPC endpoint without any credentials. */
export function serviceEndpoint(configuration: OrchardServiceConfiguration): string {
	const host = configuration.fields.find((field) => field.key === 'host')?.value;
	const port = configuration.fields.find((field) => field.key === 'port')?.value;
	if (!host) return 'RPC endpoint not configured';
	const address = host.includes(':') && !host.startsWith('[') && !host.includes('://') ? `[${host}]` : host;
	return port ? `${address}:${port}` : address;
}

/** Describe a connection using the available implementation, endpoint, mint transport, network and mint role. */
export function serviceConfigurationDetail(
	configuration: OrchardServiceConfiguration,
	chain?: string | null,
	mode?: string | null,
): string {
	const descriptor = SERVICE_DESCRIPTORS[configuration.service];
	const type = descriptor.types.find((type) => type.value === configuration.type)?.label ?? configuration.type;
	if (configuration.service !== 'mint') return [type, serviceEndpoint(configuration), chain].filter(Boolean).join(' · ');
	const mtls = configuration.fields.find((field) => field.key === 'mtls')?.value === 'true';
	return [type, serviceEndpoint(configuration), mtls ? 'mutual TLS' : 'without mTLS', serviceModeLabel(mode)].filter(Boolean).join(' · ');
}

/** Keep mode names readable without inventing a role when the probe has not answered. */
export function serviceModeLabel(mode?: string | null): string {
	if (!mode) return '';
	return SERVICE_MODE_LABELS[mode] ?? mode;
}

/** Name the environment variables that can also configure a service. */
export function serviceEnvironmentPrefix(service: ServiceKind): string {
	return `${service.toUpperCase()}_*`;
}
