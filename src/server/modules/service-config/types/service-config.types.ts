/* Native Dependencies */
import type {ServiceSettingKey} from '#server/modules/service-config/enums/service-config.enums';

export type ServiceName = 'bitcoin' | 'lightning' | 'mint';
export type ServiceFieldName =
	'type' | 'host' | 'port' | 'user' | 'password' | 'macaroon' | 'cert' | 'key' | 'ca' | 'mtls' | 'database' | 'api' | 'metrics';
export type ServiceSource = 'orchard' | 'environment' | 'none';
export type ServiceStatus = 'connected' | 'warning' | 'unreachable' | 'not_tested' | 'not_configured';
export type ConnectionValues = Partial<Record<ServiceFieldName, string>>;
export type IntegrationConfig = Record<string, string | boolean>;
export type ServiceEnvironment = Record<ServiceName, IntegrationConfig>;
export type ServiceDefinition = {
	group: string;
	enabled_key: ServiceSettingKey;
	types: string[];
	fields: {name: ServiceFieldName; config: string; key: ServiceSettingKey}[];
};
export type ConnectionCheck = {
	ok: boolean;
	warning: boolean;
	saved: boolean;
	title: string;
	context: string;
	diagnostic: string | null;
	fields: string[];
	chain: string | null;
	chain_match: boolean | null;
	mode: string | null;
	bitcoin_version: string | null;
	bitcoin_blocks: number | null;
	mint_member_id: number | null;
	mint_member_count: number | null;
};
export type ServiceState = {
	service: ServiceName;
	enabled: boolean;
	type: string | null;
	source: ServiceSource;
	status: ServiceStatus;
	database: boolean;
	public_api: boolean;
	database_type: string;
	metrics: boolean;
};
export type ServiceConfiguration = ServiceState & {fields: {key: ServiceFieldName; value: string | null; secret: boolean; set: boolean}[]};
export type ConnectionInput = {service: ServiceName; values: {key: string; value: string}[]};
