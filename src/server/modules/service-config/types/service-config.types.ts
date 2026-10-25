/* Application Dependencies */
import type {SettingKey} from '#server/modules/setting/setting.enums';

export type ServiceName = 'bitcoin' | 'lightning' | 'mint';
export type ServiceFieldName =
	'type' | 'host' | 'port' | 'user' | 'password' | 'macaroon' | 'cert' | 'key' | 'ca' | 'mtls' | 'database' | 'api';
export type ServiceSource = 'orchard' | 'environment' | 'none';
export type ServiceStatus = 'connected' | 'warning' | 'unreachable' | 'not_tested' | 'not_configured';
export type ConnectionValues = Partial<Record<ServiceFieldName, string>>;
export type IntegrationConfig = Record<string, string | boolean>;
export type ServiceEnvironment = Record<ServiceName, IntegrationConfig>;
export type ServiceDefinition = {
	group: string;
	enabled_key: SettingKey;
	types: string[];
	fields: {name: ServiceFieldName; config: string; key: SettingKey}[];
};
export type ConnectionCheck = {
	ok: boolean;
	warning: boolean;
	title: string;
	context: string;
	diagnostic: string | null;
	fields: string[];
	chain: string | null;
	chain_match: boolean | null;
	mode: string | null;
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
