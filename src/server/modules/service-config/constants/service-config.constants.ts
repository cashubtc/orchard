/* Application Dependencies */
import {SettingKey} from '#server/modules/setting/setting.enums';
import {BitcoinType} from '#server/modules/bitcoin/bitcoin.enums';
import {LightningType} from '#server/modules/lightning/lightning.enums';
import {MintType} from '#server/modules/cashu/cashu.enums';
/* Native Dependencies */
import type {ServiceDefinition, ServiceFieldName, ServiceName} from '#server/modules/service-config/types/service-config.types';

export const SERVICE_NAMES: ServiceName[] = ['bitcoin', 'lightning', 'mint'];
export const SERVICE_DEFINITIONS: Record<ServiceName, ServiceDefinition> = {
	bitcoin: {
		group: 'bitcoin',
		enabled_key: SettingKey.SERVICE_BITCOIN_ENABLED,
		types: Object.values(BitcoinType),
		fields: [
			{name: 'type', config: 'type', key: SettingKey.SERVICE_BITCOIN_TYPE},
			{name: 'host', config: 'host', key: SettingKey.SERVICE_BITCOIN_HOST},
			{name: 'port', config: 'port', key: SettingKey.SERVICE_BITCOIN_PORT},
			{name: 'user', config: 'user', key: SettingKey.SERVICE_BITCOIN_USER},
			{name: 'password', config: 'pass', key: SettingKey.SERVICE_BITCOIN_PASSWORD},
		],
	},
	lightning: {
		group: 'lightning',
		enabled_key: SettingKey.SERVICE_LIGHTNING_ENABLED,
		types: Object.values(LightningType),
		fields: [
			{name: 'type', config: 'type', key: SettingKey.SERVICE_LIGHTNING_TYPE},
			{name: 'host', config: 'host', key: SettingKey.SERVICE_LIGHTNING_HOST},
			{name: 'port', config: 'port', key: SettingKey.SERVICE_LIGHTNING_PORT},
			{name: 'macaroon', config: 'macaroon', key: SettingKey.SERVICE_LIGHTNING_MACAROON},
			{name: 'cert', config: 'cert', key: SettingKey.SERVICE_LIGHTNING_CERT},
			{name: 'key', config: 'key', key: SettingKey.SERVICE_LIGHTNING_KEY},
			{name: 'ca', config: 'ca', key: SettingKey.SERVICE_LIGHTNING_CA},
		],
	},
	mint: {
		group: 'cashu',
		enabled_key: SettingKey.SERVICE_MINT_ENABLED,
		types: Object.values(MintType),
		fields: [
			{name: 'type', config: 'type', key: SettingKey.SERVICE_MINT_TYPE},
			{name: 'host', config: 'rpc_host', key: SettingKey.SERVICE_MINT_HOST},
			{name: 'port', config: 'rpc_port', key: SettingKey.SERVICE_MINT_PORT},
			{name: 'mtls', config: 'rpc_mtls', key: SettingKey.SERVICE_MINT_MTLS},
			{name: 'ca', config: 'rpc_ca', key: SettingKey.SERVICE_MINT_CA},
			{name: 'cert', config: 'rpc_cert', key: SettingKey.SERVICE_MINT_CERT},
			{name: 'key', config: 'rpc_key', key: SettingKey.SERVICE_MINT_KEY},
			{name: 'database', config: 'database', key: SettingKey.SERVICE_MINT_DATABASE},
			{name: 'api', config: 'api', key: SettingKey.SERVICE_MINT_API},
		],
	},
};
export const SERVICE_SETTING_KEYS = new Set<SettingKey>(
	Object.values(SERVICE_DEFINITIONS).flatMap((definition) => [definition.enabled_key, ...definition.fields.map((field) => field.key)]),
);
export const SERVICE_ADDRESS_FIELDS: ServiceFieldName[] = ['host', 'api', 'database'];
export const SERVICE_FAILURE_TITLES: Record<ServiceName, string> = {
	bitcoin: "Couldn't connect to Bitcoin Core",
	lightning: "Couldn't connect to Lightning",
	mint: "Couldn't reach the mint's management RPC",
};
export const SERVICE_ENVIRONMENT_KEY = 'service_environment';
export const CONNECTION_TIMEOUT_MS = 5000;
// How long an unavailable mint database stays reported before the next status read probes it again
export const DATABASE_RECHECK_MS = 30000;
