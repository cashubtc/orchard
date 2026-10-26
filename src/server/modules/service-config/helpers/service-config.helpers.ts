/* Core Dependencies */
import type {ConfigService} from '@nestjs/config';

/* Application Dependencies */
import {replaceLocalhostInDocker} from '#server/config/configuration';
import type {StoredSettingKey} from '#server/modules/setting/setting.types';
import type {Setting} from '#server/modules/setting/setting.entity';
import {MintDatabaseType} from '#server/modules/cashu/mintdb/cashumintdb.enums';

/* Native Dependencies */
import {
	SERVICE_ADDRESS_FIELDS,
	SERVICE_DEFINITIONS,
	SERVICE_ENVIRONMENT_KEY,
	SERVICE_NAMES,
} from '#server/modules/service-config/constants/service-config.constants';
import type {
	ConnectionValues,
	IntegrationConfig,
	ServiceEnvironment,
	ServiceName,
	ServiceFieldName,
} from '#server/modules/service-config/types/service-config.types';

/** Classify a mint database value the same way as MINT_DATABASE. */
export function mintDatabaseType(database: string): MintDatabaseType {
	return /postgres(ql)?:\/\//.test(database) ? MintDatabaseType.postgres : MintDatabaseType.sqlite;
}

/** Trim form values while preserving password bytes and pasted PEM content. */
export function normalizeConnectionValue(field: ServiceFieldName, value: string): string {
	return field === 'password' || value.includes('-----BEGIN ') ? value : value.trim();
}

/** Identify certificate and TLS diagnostics without changing their upstream text. */
export function isTlsDiagnostic(diagnostic: string): boolean {
	return /certificate|\bSSL\b|\bTLS\b|\bPEM\b|private key/i.test(diagnostic);
}

/** Map connection form fields onto the integration config shape, normalized like env values. */
export function connectionConfig(service: ServiceName, values: ConnectionValues, base: IntegrationConfig = {}): IntegrationConfig {
	const config = {...base};
	for (const field of SERVICE_DEFINITIONS[service].fields) {
		const value = normalizeConnectionValue(field.name, values[field.name] ?? '');
		if (field.name === 'mtls') config[field.config] = value === 'true';
		else config[field.config] = SERVICE_ADDRESS_FIELDS.includes(field.name) ? (replaceLocalhostInDocker(value) ?? '') : value;
	}
	if (service === 'mint') {
		config.database_type = mintDatabaseType(String(config.database));
		// Env-only database TLS belongs to the env database; keep it unless Orchard now points at another one
		if (String(config.database ?? '') !== String(base.database ?? ''))
			Object.assign(config, {database_ca: '', database_cert: '', database_key: ''});
	}
	return config;
}

/** Overlay all saved fields, including deliberate blanks; an explicit removal suppresses env. */
export function mergeServiceConfig(
	service: ServiceName,
	environment: IntegrationConfig,
	settings: Map<StoredSettingKey, string>,
): IntegrationConfig {
	const definition = SERVICE_DEFINITIONS[service];
	const enabled = settings.get(definition.enabled_key);
	if (!enabled) return {...environment};
	const values: ConnectionValues = Object.fromEntries(definition.fields.map((field) => [field.name, settings.get(field.key) ?? '']));
	const config = connectionConfig(service, values, environment);
	if (enabled === 'false') config.type = '';
	return config;
}

/** Replace each group's runtime config with the boot-time environment overlaid by the stored settings. */
export function applyServiceSettings(config: ConfigService, settings: Setting[], services: ServiceName[] = SERVICE_NAMES): void {
	const stored = new Map(settings.map((setting) => [setting.key, setting.value]));
	const environment = config.get<ServiceEnvironment>(SERVICE_ENVIRONMENT_KEY);
	for (const service of services)
		config.set(SERVICE_DEFINITIONS[service].group, mergeServiceConfig(service, environment?.[service] ?? {}, stored));
}

/** Keep upstream diagnostics readable while redacting long secrets and database credentials. */
export function redactDiagnostic(error: unknown, secrets: string[]): string {
	let diagnostic = error instanceof Error ? error.message : String(error);
	for (const secret of secrets.filter((secret) => secret.length >= 8).sort((a, b) => b.length - a.length))
		diagnostic = diagnostic.split(secret).join('[redacted]');
	return diagnostic.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/g, '$1[redacted]@');
}

/** Associate common transport diagnostics with the form fields that supplied them. */
export function diagnosticFields(diagnostic: string, service: ServiceName): string[] {
	// LND rejects a macaroon from another node with "verification failed: signature mismatch"
	if (service === 'lightning' && /macaroon|signature mismatch/i.test(diagnostic)) return ['macaroon'];
	if (isTlsDiagnostic(diagnostic))
		return service === 'bitcoin' ? ['host'] : service === 'lightning' ? ['cert', 'ca', 'key'] : ['mtls', 'cert', 'ca', 'key'];
	if (/\b(401|403)\b|unauth|password|permission denied/i.test(diagnostic))
		return service === 'bitcoin' ? ['user', 'password'] : ['macaroon', 'cert', 'key'];
	return ['host', 'port'];
}
