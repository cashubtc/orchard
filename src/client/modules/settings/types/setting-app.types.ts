import {OrchardSetting} from '@shared/generated.types';

/** A parsed setting with typed value and metadata */
export interface ParsedSetting<T = string | boolean | number> {
	value: T;
	description: string | null;
	is_sensitive: boolean;
}

export interface ParsedAppSettings {
	bitcoin_oracle: ParsedSetting<boolean>;
	ai_enabled: ParsedSetting<boolean>;
	ai_vendor: ParsedSetting<string>;
	ai_ollama_api: ParsedSetting<string>;
	ai_openrouter_key: ParsedSetting<string>;
	messages_enabled: ParsedSetting<boolean>;
	messages_vendor: ParsedSetting<string>;
	messages_telegram_bot_token: ParsedSetting<string>;
	system_metrics: ParsedSetting<boolean>;
}

export type SettingsResponse = {
	settings: OrchardSetting[];
};

export type SettingsUpdateResponse = {
	settings_update: OrchardSetting[];
};
