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
