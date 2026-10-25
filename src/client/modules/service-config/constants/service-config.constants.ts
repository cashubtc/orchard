/* Native Dependencies */
import type {ServiceDescriptors, ServiceField} from '@client/modules/service-config/types/service-config.types';

export const SERVICE_DESCRIPTORS: ServiceDescriptors = {
	bitcoin: {
		name: 'Bitcoin',
		icon: 'currency_bitcoin',
		description: 'Blockchain, mempool and on-chain activity',
		types: [{value: 'core', label: 'Bitcoin Core'}],
	},
	lightning: {
		name: 'Lightning',
		icon: 'bolt',
		description: 'Channels, payments and wallet activity',
		types: [
			{value: 'lnd', label: 'LND'},
			{value: 'cln', label: 'Core Lightning'},
		],
	},
	mint: {
		name: 'Mint',
		icon: 'account_balance',
		description: 'Cashu mint management and federation',
		types: [
			{value: 'cdk', label: 'CDK'},
			{value: 'nutshell', label: 'Nutshell'},
		],
	},
};
export const SERVICE_FIELDS: ServiceField[] = [
	{key: 'host', label: 'RPC host', placeholder: '127.0.0.1'},
	{key: 'port', label: 'RPC port'},
	{key: 'user', label: 'RPC user'},
	{key: 'password', label: 'RPC password', password: true},
	{key: 'macaroon', label: 'Macaroon', credential: true, multiline: true},
	{key: 'ca', label: 'CA certificate', credential: true, multiline: true},
	{key: 'cert', label: 'TLS / client certificate', credential: true, multiline: true},
	{key: 'key', label: 'Client key', credential: true, multiline: true},
	{key: 'database', label: 'Mint database', placeholder: '/path/to/mint.sqlite or PostgreSQL URL', optional: true},
	{key: 'api', label: 'Public mint URL', placeholder: 'https://mint.example.com', optional: true},
];
export const SERVICE_DEFAULT_PORTS: Record<string, string> = {
	core: '8332',
	lnd: '10009',
	cln: '9736',
	cdk: '8086',
	nutshell: '8086',
};
export const SERVICE_SOURCE_LABELS: Record<string, string> = {
	orchard: 'Saved in Orchard',
	environment: 'From environment',
	none: 'Not configured',
};
export const SERVICE_STATUS_LABELS: Record<string, string> = {
	connected: 'Connected',
	warning: 'Connected with a warning',
	unreachable: 'Connection failed',
	not_tested: 'Not tested',
	not_configured: 'Not configured',
};
