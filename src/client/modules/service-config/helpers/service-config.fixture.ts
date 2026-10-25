/* Shared Dependencies */
import {ServiceKind, type OrchardServiceConfiguration} from '@shared/generated.types';

/** A saved connection fixture with an undisclosed password for form tests. */
export function bitcoinConfiguration(): OrchardServiceConfiguration {
	return {
		service: ServiceKind.Bitcoin,
		enabled: true,
		type: 'core',
		source: 'orchard',
		status: 'connected',
		database: false,
		public_api: false,
		database_type: 'sqlite',
		metrics: false,
		fields: [
			{key: 'type', value: 'core', secret: false, set: true},
			{key: 'host', value: 'localhost', secret: false, set: true},
			{key: 'port', value: '8332', secret: false, set: true},
			{key: 'user', value: 'operator', secret: false, set: true},
			{key: 'password', value: null, secret: true, set: true},
		],
	};
}
