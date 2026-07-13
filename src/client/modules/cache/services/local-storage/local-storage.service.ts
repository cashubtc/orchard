/* Core Dependencies */
import {Injectable} from '@angular/core';
/* Local Dependencies */
import {
	Timezone,
	Locale,
	Theme,
	Model,
	Currency,
	ThemeType,
	CurrencyType,
	BitcoinOracleSettings,
	MintDashboardSettings,
	MintSystemSettings,
	MintKeysetsSettings,
	MintDatabaseSettings,
	MintConfigSettings,
	SystemMetricsSettings,
	SettingsDeviceSettings,
	SettingsAppSettings,
	EventLogSettings,
	AiFavorites,
} from './local-storage.types';

@Injectable({
	providedIn: 'root',
})
export class LocalStorageService {
	private readonly STORAGE_KEYS = {
		/* Auth Settings */
		AUTH_TOKEN_KEY: 'v0.auth.token',
		REFRESH_TOKEN_KEY: 'v0.auth.refresh_token',
		/* User Settings */
		TIMEZONE_KEY: 'v0.setting.timezone',
		LOCALE_KEY: 'v0.setting.locale',
		THEME_KEY: 'v0.setting.theme',
		MODEL_KEY: 'v0.setting.model',
		CURRENCY_KEY: 'v0.setting.currency',
		/* Bitcoin Oracle Settings */
		BITCOIN_ORACLE_KEY: 'v0.bitcoin.oracle.settings',
		/* Mint Settings */
		MINT_DASHBOARD_KEY: 'v3.mint.dashboard.settings',
		MINT_CONFIG_KEY: 'v1.mint.config.settings',
		MINT_KEYSETS_KEY: 'v1.mint.keysets.settings',
		MINT_DATABASE_KEY: 'v1.mint.database.settings',
		MINT_SYSTEM_KEY: 'v0.mint.system.settings',
		/* System Settings */
		SYSTEM_METRICS_KEY: 'v0.system.metrics.settings',
		/* Settings Settings */
		SETTINGS_DEVICE_KEY: 'v1.settings.device.settings',
		SETTINGS_APP_KEY: 'v0.settings.app.settings',
		/* AI Settings */
		AI_FAVORITES_KEY: 'v0.setting.ai_favorites',
		/* Event Log Settings */
		EVENT_LOG_KEY: 'v0.event.log.settings',
	};

	constructor() {}

	/**
	 * Get an item from local storage
	 * @param key The key to retrieve
	 * @returns The stored value or null if not found
	 */
	getItem<T>(key: string): T | null {
		const item = localStorage.getItem(key);
		if (!item) return null;

		try {
			return JSON.parse(item);
		} catch (error) {
			console.error(`Error parsing item with key ${key} from localStorage:`, error);
			return null;
		}
	}

	/**
	 * Store an item in local storage
	 * @param key The key to store the value under
	 * @param value The value to store
	 */
	setItem(key: string, value: any): void {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {
			console.error(`Error storing item with key ${key} in localStorage:`, error);
		}
	}

	getAuthToken(): string | null {
		return this.getItem<string>(this.STORAGE_KEYS.AUTH_TOKEN_KEY);
	}
	getRefreshToken(): string | null {
		return this.getItem<string>(this.STORAGE_KEYS.REFRESH_TOKEN_KEY);
	}
	getTimezone(): Timezone {
		const timezone = this.getItem<Timezone>(this.STORAGE_KEYS.TIMEZONE_KEY);
		if (!timezone) return {tz: null};
		return timezone;
	}
	getLocale(): Locale {
		const locale = this.getItem<Locale>(this.STORAGE_KEYS.LOCALE_KEY);
		if (!locale) return {code: null};
		return locale;
	}
	getTheme(): Theme {
		const theme = this.getItem<Theme>(this.STORAGE_KEYS.THEME_KEY);
		if (!theme) return {type: ThemeType.DARK_MODE};
		return theme;
	}
	getModel(): Model {
		const model = this.getItem<Model>(this.STORAGE_KEYS.MODEL_KEY);
		if (!model) return {model: null};
		return model;
	}
	getCurrency(): Currency {
		const currency = this.getItem<Currency>(this.STORAGE_KEYS.CURRENCY_KEY);
		if (!currency) return {type_btc: CurrencyType.GLYPH, type_fiat: CurrencyType.GLYPH};
		return currency;
	}
	getBitcoinOracleSettings(): BitcoinOracleSettings {
		const settings = this.getItem<BitcoinOracleSettings>(this.STORAGE_KEYS.BITCOIN_ORACLE_KEY);
		if (!settings) return {date_start: null, date_preset: null};
		return settings;
	}
	getMintDashboardSettings(): MintDashboardSettings {
		const settings = this.getItem<MintDashboardSettings>(this.STORAGE_KEYS.MINT_DASHBOARD_KEY);
		if (!settings)
			return {
				date_start: null,
				date_preset: null,
				units: null,
				interval: null,
				type: {balance_sheet: null, mints: null, melts: null, swaps: null, fee_revenue: null, ecash: null},
				summary_nav: null,
				chart_nav: null,
				oracle_used: null,
			};
		return settings;
	}
	getMintConfigSettings(): MintConfigSettings {
		const settings = this.getItem<MintConfigSettings>(this.STORAGE_KEYS.MINT_CONFIG_KEY);
		if (!settings) return {tertiary_nav: null};
		return settings;
	}
	getMintSystemSettings(): MintSystemSettings {
		const settings = this.getItem<MintSystemSettings>(this.STORAGE_KEYS.MINT_SYSTEM_KEY);
		if (!settings) return {date_start: null, date_preset: null, interval: null};
		return settings;
	}
	getMintKeysetsSettings(): MintKeysetsSettings {
		const settings = this.getItem<MintKeysetsSettings>(this.STORAGE_KEYS.MINT_KEYSETS_KEY);
		if (!settings) return {date_start: null, date_preset: null, units: null, status: null};
		return settings;
	}
	getMintDatabaseSettings(): MintDatabaseSettings {
		const settings = this.getItem<MintDatabaseSettings>(this.STORAGE_KEYS.MINT_DATABASE_KEY);
		if (!settings) return {date_start: null, date_preset: null, type: null, units: null, states: null};
		return settings;
	}
	getSettingsDeviceSettings(): SettingsDeviceSettings {
		const settings = this.getItem<SettingsDeviceSettings>(this.STORAGE_KEYS.SETTINGS_DEVICE_KEY);
		if (!settings) return {tertiary_nav: null};
		return settings;
	}
	getSettingsAppSettings(): SettingsAppSettings {
		const settings = this.getItem<SettingsAppSettings>(this.STORAGE_KEYS.SETTINGS_APP_KEY);
		if (!settings) return {tertiary_nav: null};
		return settings;
	}
	getAiFavorites(): AiFavorites {
		const favorites = this.getItem<AiFavorites>(this.STORAGE_KEYS.AI_FAVORITES_KEY);
		if (!favorites) return {ollama: [], openrouter: []};
		return favorites;
	}
	getEventLogSettings(): EventLogSettings {
		const settings = this.getItem<EventLogSettings>(this.STORAGE_KEYS.EVENT_LOG_KEY);
		if (!settings) return {date_start: null, date_preset: null, page_size: null};
		return settings;
	}
    getSystemMetricsSettings(): SystemMetricsSettings {
		const settings = this.getItem<SystemMetricsSettings>(this.STORAGE_KEYS.SYSTEM_METRICS_KEY);
		if (!settings) return {date_start: null, date_preset: null, interval: null};
		return settings;
	}

	setAuthToken(token: string | null): void {
		this.setItem(this.STORAGE_KEYS.AUTH_TOKEN_KEY, token);
	}
	setRefreshToken(token: string | null): void {
		this.setItem(this.STORAGE_KEYS.REFRESH_TOKEN_KEY, token);
	}
	setTimezone(timezone: Timezone): void {
		this.setItem(this.STORAGE_KEYS.TIMEZONE_KEY, timezone);
	}
	setLocale(locale: Locale): void {
		this.setItem(this.STORAGE_KEYS.LOCALE_KEY, locale);
	}
	setTheme(theme: Theme): void {
		this.setItem(this.STORAGE_KEYS.THEME_KEY, theme);
	}
	setModel(model: Model): void {
		this.setItem(this.STORAGE_KEYS.MODEL_KEY, model);
	}
	setCurrency(currency: Currency): void {
		this.setItem(this.STORAGE_KEYS.CURRENCY_KEY, currency);
	}
	setBitcoinOracleSettings(settings: BitcoinOracleSettings): void {
		this.setItem(this.STORAGE_KEYS.BITCOIN_ORACLE_KEY, settings);
	}
	setMintDashboardSettings(settings: MintDashboardSettings): void {
		this.setItem(this.STORAGE_KEYS.MINT_DASHBOARD_KEY, settings);
	}
	setMintConfigSettings(settings: MintConfigSettings): void {
		this.setItem(this.STORAGE_KEYS.MINT_CONFIG_KEY, settings);
	}
	setMintSystemSettings(settings: MintSystemSettings): void {
		this.setItem(this.STORAGE_KEYS.MINT_SYSTEM_KEY, settings);
	}
	setMintKeysetsSettings(settings: MintKeysetsSettings): void {
		this.setItem(this.STORAGE_KEYS.MINT_KEYSETS_KEY, settings);
	}
	setMintDatabaseSettings(settings: MintDatabaseSettings): void {
		this.setItem(this.STORAGE_KEYS.MINT_DATABASE_KEY, settings);
	}
	setSettingsDeviceSettings(settings: SettingsDeviceSettings): void {
		this.setItem(this.STORAGE_KEYS.SETTINGS_DEVICE_KEY, settings);
	}
	setSettingsAppSettings(settings: SettingsAppSettings): void {
		this.setItem(this.STORAGE_KEYS.SETTINGS_APP_KEY, settings);
	}
	setAiFavorites(favorites: AiFavorites): void {
		this.setItem(this.STORAGE_KEYS.AI_FAVORITES_KEY, favorites);
	}
	setEventLogSettings(settings: EventLogSettings): void {
		this.setItem(this.STORAGE_KEYS.EVENT_LOG_KEY, settings);
	}
    setSystemMetricsSettings(settings: SystemMetricsSettings): void {
		this.setItem(this.STORAGE_KEYS.SYSTEM_METRICS_KEY, settings);
	}

	/**
	 * Remove an item from local storage
	 * @param key The key to remove
	 */
	removeItem(key: string): void {
		localStorage.removeItem(key);
	}

	/**
	 * Clear all items from local storage
	 */
	clear(): void {
		localStorage.clear();
	}

	/**
	 * Check if a key exists in local storage
	 * @param key The key to check
	 * @returns True if the key exists, false otherwise
	 */
	hasItem(key: string): boolean {
		return localStorage.getItem(key) !== null;
	}
}
