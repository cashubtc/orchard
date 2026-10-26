/* Shared Dependencies */
import {ServiceKind, type OrchardServiceConfiguration} from '@shared/generated.types';

/** Build complete service configurations for wizard tests without real credentials. */
export function onboardingConfiguration(service: ServiceKind, enabled = false, source = 'none'): OrchardServiceConfiguration {
	const type = service === ServiceKind.Bitcoin ? 'core' : service === ServiceKind.Lightning ? 'lnd' : 'cdk';
	const keys =
		service === ServiceKind.Bitcoin
			? ['user', 'password']
			: service === ServiceKind.Lightning
				? ['ca', 'cert', 'key', 'macaroon']
				: ['mtls', 'ca', 'cert', 'key', 'database', 'api'];
	return {
		service,
		enabled,
		type: enabled ? type : null,
		source,
		status: enabled ? 'not_tested' : 'not_configured',
		database: false,
		public_api: false,
		database_type: 'sqlite',
		metrics: false,
		fields: ['type', 'host', 'port', ...keys].map((key) => ({
			key,
			value: key === 'type' ? type : key === 'host' ? 'localhost' : key === 'port' ? '8091' : '',
			set: false,
			secret: key === 'password',
		})),
	};
}
