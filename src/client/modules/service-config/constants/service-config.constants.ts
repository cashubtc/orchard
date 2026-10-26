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
	{
		key: 'database',
		label: 'Mint database',
		placeholder: '/path/to/mint.sqlite or PostgreSQL URL',
		optional: true,
		heading: 'Analytics and public URL (optional)',
	},
	{key: 'api', label: 'Public mint URL', placeholder: 'https://mint.example.com', optional: true},
];
// Columns of a twelve-column row; a client key and CA certificate split the certificate's row three ways
export const SERVICE_FIELD_SPANS: Record<string, number> = {
	host: 9,
	port: 3,
	user: 6,
	password: 6,
	macaroon: 6,
	cert: 6,
	ca: 4,
	key: 4,
	database: 6,
	api: 6,
};
export const SERVICE_TRANSPORTS = [
	{value: 'true', label: 'Mutual TLS'},
	{value: 'false', label: 'Without mTLS'},
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
export const SERVICE_STATUS_ICONS: Record<string, string> = {
	connected: 'check_circle',
	warning: 'warning',
	unreachable: 'warning',
	not_tested: 'circle',
	not_configured: 'do_not_disturb_on',
};
export const SERVICE_MODE_LABELS: Record<string, string> = {
	member: 'Federation member',
	standalone: 'Standalone mint',
	setup: 'Federation setup',
	unreachable: 'Unreachable',
};
const SERVICE_MTLS_CAPTION =
	'Mutual TLS uses a CA certificate, client certificate and client key. Paste a PEM or enter a file path. Pasted keys are stored encrypted.';
// Keyed by implementation, like the default ports
export const SERVICE_CREDENTIAL_CAPTIONS: Record<string, string> = {
	core: 'The password is stored encrypted.',
	lnd: 'Paste the macaroon as hex or the certificate as PEM, or enter a file path. Pasted values are stored encrypted.',
	cln: SERVICE_MTLS_CAPTION,
	cdk: SERVICE_MTLS_CAPTION,
	nutshell: SERVICE_MTLS_CAPTION,
};
