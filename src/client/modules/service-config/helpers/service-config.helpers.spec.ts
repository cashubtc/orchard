import {ServiceKind} from '@shared/generated.types';
import {bitcoinConfiguration} from './service-config.fixture';
import {
	createServiceForm,
	serviceAppliedConfiguration,
	serviceConfigurationDetail,
	serviceEndpoint,
	serviceEnvironmentPrefix,
	serviceFormInput,
	serviceModeLabel,
	servicePemDescription,
	servicePemMask,
	visibleServiceFields,
} from './service-config.helpers';

describe('service configuration helpers', () => {
	it('defaults missing connection fields without filling a held secret', () => {
		const configuration = bitcoinConfiguration();
		configuration.fields = configuration.fields.map((field) => ({...field, value: null}));
		const form = createServiceForm(configuration);
		expect(form.controls['host'].value).toBe('127.0.0.1');
		expect(form.controls['port'].value).toBe('8332');
		expect(form.controls['type'].value).toBe('core');
		expect(form.controls['password'].value).toBe('');
		expect(serviceFormInput(configuration, form).values.some((value) => value.key === 'password')).toBeFalse();
		form.controls['password'].markAsDirty();
		expect(serviceFormInput(configuration, form).values.find((value) => value.key === 'password')?.value).toBe('');
	});
	it('selects only the credentials supported by each transport', () => {
		expect(visibleServiceFields(ServiceKind.Bitcoin, 'core', 'false').map((field) => field.key)).toEqual([
			'host',
			'port',
			'user',
			'password',
		]);
		expect(visibleServiceFields(ServiceKind.Lightning, 'lnd', 'false').map((field) => field.key)).toEqual([
			'host',
			'port',
			'macaroon',
			'cert',
		]);
		expect(visibleServiceFields(ServiceKind.Lightning, 'cln', 'false').map((field) => field.key)).toEqual([
			'host',
			'port',
			'ca',
			'cert',
			'key',
		]);
		expect(visibleServiceFields(ServiceKind.Mint, 'cdk', 'false').some((field) => field.credential)).toBeFalse();
		expect(
			visibleServiceFields(ServiceKind.Mint, 'cdk', 'true')
				.filter((field) => field.credential)
				.map((field) => field.key),
		).toEqual(['ca', 'cert', 'key']);
		expect(visibleServiceFields(ServiceKind.Mint, 'cdk', 'false').map((field) => field.key)).toEqual([
			'host',
			'port',
			'database',
			'api',
			'metrics',
		]);
		// Only cdk-mintd serves Prometheus metrics
		expect(visibleServiceFields(ServiceKind.Mint, 'nutshell', 'false').some((field) => field.key === 'metrics')).toBeFalse();
	});
	it('describes pasted PEMs by line count and hides all but their armour lines', () => {
		const pem = '-----BEGIN PRIVATE KEY-----\nAAAA\nBBBB\n-----END PRIVATE KEY-----\n';
		expect(servicePemDescription(pem)).toBe('PEM · 4 lines');
		expect(servicePemDescription('/certs/ca.pem')).toBe('File on the Orchard host');
		expect(servicePemDescription('')).toBe('');
		expect(servicePemMask(pem)).toEqual({begin: '-----BEGIN PRIVATE KEY-----', end: '-----END PRIVATE KEY-----', hidden: 2});
		expect(servicePemMask('/certs/client.key')).toBeNull();
	});
	it('keeps IPv6 endpoints unambiguous', () => {
		const configuration = bitcoinConfiguration();
		configuration.fields.find((field) => field.key === 'host')!.value = '::1';
		expect(serviceEndpoint(configuration)).toBe('[::1]:8332');
	});
	it('describes the network for nodes and the transport and role for mints', () => {
		expect(serviceConfigurationDetail(bitcoinConfiguration(), 'signet')).toBe('Bitcoin Core · localhost:8332 · signet');
		const mint = {...bitcoinConfiguration(), service: ServiceKind.Mint, type: 'cdk'};
		mint.fields = [...mint.fields, {key: 'mtls', value: 'true', secret: false, set: true}];
		expect(serviceConfigurationDetail(mint, 'signet', 'member')).toBe('CDK · localhost:8332 · mutual TLS · Federation member');
		expect(serviceModeLabel(null)).toBe('');
		expect(serviceModeLabel('custom')).toBe('custom');
		expect(serviceEnvironmentPrefix(ServiceKind.Lightning)).toBe('LIGHTNING_*');
	});
	it('applies submitted values without copying a credential', () => {
		const configuration = {...bitcoinConfiguration(), source: 'environment'};
		const form = createServiceForm(configuration);
		form.controls['port'].setValue('18443');
		form.controls['password'].setValue('draft');
		const applied = serviceAppliedConfiguration(configuration, form);
		expect(applied.source).toBe('orchard');
		expect(applied.fields.find((field) => field.key === 'port')?.value).toBe('18443');
		expect(applied.fields.find((field) => field.key === 'password')?.value).toBeNull();
	});
});
