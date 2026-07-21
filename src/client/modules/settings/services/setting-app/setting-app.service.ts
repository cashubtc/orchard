/* Core Dependencies */
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
/* Vendor Dependencies */
import {Observable, map, tap, catchError, throwError} from 'rxjs';
/* Application Dependencies */
import {getApiQuery} from '@client/modules/api/helpers/api.helpers';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {OrchardRes} from '@client/modules/api/types/api.types';
import {ApiService} from '@client/modules/api/services/api/api.service';
/* Native Dependencies */
import {Setting} from '@client/modules/settings/classes/setting.class';
import {ParsedAppSettings, ParsedSetting, SettingsResponse, SettingsUpdateResponse} from '@client/modules/settings/types/setting-app.types';
/* Local Dependencies */
import {SETTINGS_QUERY, SETTINGS_UPDATE_MUTATION} from './setting-app.queries';
/* Shared Dependencies */
import {SettingKey, SettingValue} from '@shared/generated.types';

/** Default ParsedSetting factory */
const defaultSetting = <T>(value: T): ParsedSetting<T> => ({value, description: null, is_sensitive: false});

const SETTING_DEFAULTS: ParsedAppSettings = {
	bitcoin_oracle: defaultSetting(false),
	ai_enabled: defaultSetting(false),
	ai_vendor: defaultSetting('ollama'),
	ai_ollama_api: defaultSetting('http://localhost:11434'),
	ai_openrouter_key: defaultSetting(''),
	messages_enabled: defaultSetting(false),
	messages_vendor: defaultSetting('telegram'),
	messages_telegram_bot_token: defaultSetting(''),
	system_metrics: defaultSetting(true),
};

@Injectable({
	providedIn: 'root',
})
export class SettingAppService {
	private parsed_settings: ParsedAppSettings = {...SETTING_DEFAULTS};

	constructor(
		private http: HttpClient,
		private apiService: ApiService,
	) {}

	public loadSettings(): Observable<Setting[]> {
		const query = getApiQuery(SETTINGS_QUERY);
		return this.http.post<OrchardRes<SettingsResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.settings;
			}),
			map((settings) => settings.map((setting) => new Setting(setting))),
			tap((settings) => {
				this.updateParsedSettings(settings);
			}),
			catchError((error) => {
				return throwError(() => error);
			}),
		);
	}

	/**
	 * Update multiple settings in a single request
	 * @param {SettingKey[]} keys - The setting keys to update
	 * @param {string[]} values - The new values for the settings
	 * @returns {Observable<Setting[]>} The updated settings
	 */
	public updateSettings(keys: SettingKey[], values: string[]): Observable<Setting[]> {
		const query = getApiQuery(SETTINGS_UPDATE_MUTATION, {keys, values});
		return this.http.post<OrchardRes<SettingsUpdateResponse>>(this.apiService.api, query).pipe(
			map((response) => {
				if (response.errors) throw new OrchardErrors(response.errors);
				return response.data.settings_update;
			}),
			map((settings) => settings.map((setting) => new Setting(setting))),
			tap((updated_settings) => {
				this.updateParsedSettings(updated_settings);
			}),
			catchError((error) => {
				return throwError(() => error);
			}),
		);
	}

	/**
	 * Get a specific parsed setting by key
	 * @param {K} key - The setting key to look up
	 * @returns {ParsedAppSettings[K]} The parsed setting (falls back to default)
	 */
	public getSetting<K extends keyof ParsedAppSettings>(key: K): ParsedAppSettings[K] {
		return this.parsed_settings[key];
	}

	/**
	 * Get a copy of all parsed settings
	 */
	public getParsedSettings(): ParsedAppSettings {
		return {...this.parsed_settings};
	}

	/**
	 * Build a ParsedSetting from a raw Setting entity
	 */
	private toParsedSetting<T>(setting: Setting): ParsedSetting<T> {
		return {
			value: this.parseSettingValue(setting) as T,
			description: setting.description ?? null,
			is_sensitive: setting.is_sensitive,
		};
	}

	/**
	 * Parse a setting value based on its type
	 * @param {Setting} setting - The setting to parse
	 * @returns {boolean | number | string | any} The parsed value
	 */
	private parseSettingValue(setting: Setting): boolean | number | string | any {
		switch (setting.value_type) {
			case SettingValue.Boolean:
				return setting.value === 'true';
			case SettingValue.Number:
				return Number(setting.value);
			case SettingValue.Json:
				try {
					return JSON.parse(setting.value);
				} catch (error) {
					console.error('Failed to parse JSON setting value:', error);
					return null;
				}
			case SettingValue.String:
			default:
				return setting.value;
		}
	}

	/**
	 * Update the parsed settings cache from raw settings
	 */
	private updateParsedSettings(settings: Setting[]): void {
		const find = (key: SettingKey): Setting | undefined => settings.find((s) => s.key === key);
		const bitcoin_oracle = find(SettingKey.BitcoinOracle);
		const ai_enabled = find(SettingKey.AiEnabled);
		const ai_vendor = find(SettingKey.AiVendor);
		const ai_ollama_api = find(SettingKey.AiOllamaApi);
		const ai_openrouter_key = find(SettingKey.AiOpenrouterKey);
		const messages_enabled = find(SettingKey.MessagesEnabled);
		const messages_vendor = find(SettingKey.MessagesVendor);
		const messages_telegram_bot_token = find(SettingKey.MessagesTelegramBotToken);
		const system_metrics = find(SettingKey.SystemMetrics);
		if (bitcoin_oracle) this.parsed_settings.bitcoin_oracle = this.toParsedSetting<boolean>(bitcoin_oracle);
		if (ai_enabled) this.parsed_settings.ai_enabled = this.toParsedSetting<boolean>(ai_enabled);
		if (ai_vendor) this.parsed_settings.ai_vendor = this.toParsedSetting<string>(ai_vendor);
		if (ai_ollama_api) this.parsed_settings.ai_ollama_api = this.toParsedSetting<string>(ai_ollama_api);
		if (ai_openrouter_key) this.parsed_settings.ai_openrouter_key = this.toParsedSetting<string>(ai_openrouter_key);
		if (messages_enabled) this.parsed_settings.messages_enabled = this.toParsedSetting<boolean>(messages_enabled);
		if (messages_vendor) this.parsed_settings.messages_vendor = this.toParsedSetting<string>(messages_vendor);
		if (messages_telegram_bot_token)
			this.parsed_settings.messages_telegram_bot_token = this.toParsedSetting<string>(messages_telegram_bot_token);
		if (system_metrics) this.parsed_settings.system_metrics = this.toParsedSetting<boolean>(system_metrics);
	}
}
