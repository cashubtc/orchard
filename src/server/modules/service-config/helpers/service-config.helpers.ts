/* Core Dependencies */
import type {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {replaceLocalhostInDocker} from '#server/config/configuration';
import type {SettingKey} from '#server/modules/setting/setting.enums';
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
} from '#server/modules/service-config/types/service-config.types';

/** Classify a mint database value the same way as MINT_DATABASE. */
export function mintDatabaseType(database: string): MintDatabaseType {
	return /postgres(ql)?:\/\//.test(database) ? MintDatabaseType.postgres : MintDatabaseType.sqlite;
}

/** Map connection form fields onto the integration config shape, normalized like env values. */
export function connectionConfig(service: ServiceName, values: ConnectionValues, base: IntegrationConfig = {}): IntegrationConfig {
	const config = {...base};
	for (const field of SERVICE_DEFINITIONS[service].fields) {
		const value = values[field.name] ?? '';
		if (field.name === 'mtls') config[field.config] = value === 'true';
		else config[field.config] = SERVICE_ADDRESS_FIELDS.includes(field.name) ? (replaceLocalhostInDocker(value) ?? '') : value;
	}
	if (service === 'mint') config.database_type = mintDatabaseType(String(config.database));
	return config;
}

/** Overlay all saved fields, including deliberate blanks; an explicit removal suppresses env. */
export function mergeServiceConfig(
	service: ServiceName,
	environment: IntegrationConfig,
	settings: Map<SettingKey, string>,
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

/** Preserve upstream text, except credential material which must never cross the API boundary. */
export function redactDiagnostic(error: unknown, secrets: string[]): string {
	let diagnostic = error instanceof Error ? error.message : String(error);
	for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length))
		diagnostic = diagnostic.split(secret).join('[redacted]');
	return diagnostic.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/g, '$1[redacted]@');
}

/** Associate common transport diagnostics with the form fields that supplied them. */
export function diagnosticFields(diagnostic: string, service: ServiceName): string[] {
	// LND rejects a macaroon from another node with "verification failed: signature mismatch"
	if (service === 'lightning' && /macaroon|signature mismatch/i.test(diagnostic)) return ['macaroon'];
	if (/certificate|SSL|TLS|PEM|private key/i.test(diagnostic))
		return service === 'bitcoin' ? ['host'] : service === 'lightning' ? ['cert', 'ca', 'key'] : ['mtls', 'cert', 'ca', 'key'];
	if (/\b(401|403)\b|unauth|password|permission denied/i.test(diagnostic))
		return service === 'bitcoin' ? ['user', 'password'] : ['macaroon', 'cert', 'key'];
	return ['host', 'port'];
}
