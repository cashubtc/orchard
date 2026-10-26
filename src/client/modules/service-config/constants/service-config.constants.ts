/* Native Dependencies */
import type {ServiceDescriptors, ServiceField, ServiceOption} from '@client/modules/service-config/types/service-config.types';

export const SERVICE_DESCRIPTORS: ServiceDescriptors = {
	bitcoin: {
		name: 'Bitcoin',
		icon: 'currency_bitcoin',
		description: 'Blockchain, mempool and on-chain activity',
		types: [{value: 'core', label: 'Bitcoin Core', detail: 'JSON-RPC with a user and password'}],
	},
	lightning: {
		name: 'Lightning',
		icon: 'bolt',
		description: 'Channels, payments and wallet activity',
		types: [
			{value: 'lnd', label: 'LND', detail: 'gRPC with a macaroon'},
			{value: 'cln', label: 'Core Lightning', detail: 'gRPC with mutual TLS'},
		],
	},
	mint: {
		name: 'Mint',
		icon: 'account_balance',
		description: 'Cashu mint management and federation',
		types: [
			{value: 'cdk', label: 'CDK', detail: 'Standalone or federation member'},
			{value: 'nutshell', label: 'Nutshell', detail: 'Standalone Python mint'},
		],
	},
};
export const SERVICE_FIELDS: ServiceField[] = [
	{key: 'host', label: 'RPC host', placeholder: '127.0.0.1'},
	{key: 'port', label: 'RPC port'},
	{key: 'user', label: 'RPC user'},
	{key: 'password', label: 'RPC password', password: true},
	{key: 'macaroon', label: 'Macaroon', credential: true, multiline: true},
	{key: 'ca', label: 'CA certificate', credential: true, multiline: true, pem: true},
	{key: 'cert', label: 'TLS / client certificate', credential: true, multiline: true, pem: true},
	{key: 'key', label: 'Client key', credential: true, multiline: true, pem: true},
	{
		key: 'database',
		label: 'Mint database',
		placeholder: '/path/to/mint.sqlite or postgres://…',
		help: 'A SQLite file path or a postgres:// URL. Orchard reads balances, keysets and activity from it.',
	},
	{
		key: 'api',
		label: 'Public mint URL',
		placeholder: 'https://mint.example.com',
		help: "The address wallets use. Orchard reads the mint's public info from it.",
	},
	{
		key: 'metrics',
		label: 'Prometheus metrics URL (optional)',
		placeholder: 'http://127.0.0.1:9090',
		help: "cdk-mintd's Prometheus endpoint, without /metrics. Adds its charts to the mint's System page.",
		advanced: true,
	},
];
// Columns of a twelve-column row; credential files and mint details take a whole row
export const SERVICE_FIELD_SPANS: Record<string, number> = {
	host: 9,
	port: 3,
	user: 6,
	password: 6,
};
// The mint form's headings, each placed before the field that opens its section
export const SERVICE_MINT_SECTIONS: Record<string, string> = {
	host: 'Management RPC',
	ca: 'Mutual TLS certificates',
	database: 'Mint data',
};
export const SERVICE_TRANSPORTS: Pick<ServiceOption, 'value' | 'label'>[] = [
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
	'Paste each PEM, or enter a file path on the Orchard host. A pasted key is hidden straight away and stored encrypted.';
// Keyed by implementation, like the default ports
export const SERVICE_CREDENTIAL_CAPTIONS: Record<string, string> = {
	core: 'The password is stored encrypted.',
	lnd: 'Paste the macaroon as hex or the certificate as PEM, or enter a file path. Pasted values are stored encrypted.',
	cln: SERVICE_MTLS_CAPTION,
	cdk: SERVICE_MTLS_CAPTION,
	nutshell: SERVICE_MTLS_CAPTION,
};
