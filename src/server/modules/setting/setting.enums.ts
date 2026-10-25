export enum SettingValue {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	JSON = 'json',
}

/**
 * Sensitivity levels for settings.
 * - ALWAYS: Keys and tokens. Always sensitive regardless of value.
 * - CONTENT: Certs and macaroons. Sensitive when value is pasted content,
 *            NOT sensitive when value is a file path.
 * - NONE: Regular settings (booleans, vendor names, etc.)
 */
export enum SettingSensitivity {
	ALWAYS = 'always',
	CONTENT = 'content',
	NONE = 'none',
}

export enum SettingKey {
	SERVICE_BITCOIN_ENABLED = 'service.bitcoin.enabled',
	SERVICE_BITCOIN_TYPE = 'service.bitcoin.type',
	SERVICE_BITCOIN_HOST = 'service.bitcoin.host',
	SERVICE_BITCOIN_PORT = 'service.bitcoin.port',
	SERVICE_BITCOIN_USER = 'service.bitcoin.user',
	SERVICE_BITCOIN_PASSWORD = 'service.bitcoin.password',
	SERVICE_LIGHTNING_ENABLED = 'service.lightning.enabled',
	SERVICE_LIGHTNING_TYPE = 'service.lightning.type',
	SERVICE_LIGHTNING_HOST = 'service.lightning.host',
	SERVICE_LIGHTNING_PORT = 'service.lightning.port',
	SERVICE_LIGHTNING_MACAROON = 'service.lightning.macaroon',
	SERVICE_LIGHTNING_CERT = 'service.lightning.cert',
	SERVICE_LIGHTNING_KEY = 'service.lightning.key',
	SERVICE_LIGHTNING_CA = 'service.lightning.ca',
	SERVICE_MINT_ENABLED = 'service.mint.enabled',
	SERVICE_MINT_TYPE = 'service.mint.type',
	SERVICE_MINT_HOST = 'service.mint.host',
	SERVICE_MINT_PORT = 'service.mint.port',
	SERVICE_MINT_MTLS = 'service.mint.mtls',
	SERVICE_MINT_CA = 'service.mint.ca',
	SERVICE_MINT_CERT = 'service.mint.cert',
	SERVICE_MINT_KEY = 'service.mint.key',
	SERVICE_MINT_DATABASE = 'service.mint.database',
	SERVICE_MINT_API = 'service.mint.api',

	BITCOIN_ORACLE = 'bitcoin.oracle',
	AI_ENABLED = 'ai.enabled',
	AI_VENDOR = 'ai.vendor',
	AI_OLLAMA_API = 'ai.ollama.api',
	AI_OPENROUTER_KEY = 'ai.openrouter.key',
	MESSAGES_ENABLED = 'messages.enabled',
	MESSAGES_VENDOR = 'messages.vendor',
	MESSAGES_TELEGRAM_BOT_TOKEN = 'messages.telegram.bot.token',
	SYSTEM_METRICS = 'system.metrics',
}
