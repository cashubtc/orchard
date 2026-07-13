/* Core Dependencies */
import {Injectable} from '@angular/core';
/* Vendor Dependencies */
import {DateAdapter} from '@angular/material/core';
import {Settings} from 'luxon';
/* Application Dependencies */
import {LocalStorageService} from '@client/modules/cache/services/local-storage/local-storage.service';
import {ThemeType, CurrencyType, Currency, AiFavorites} from '@client/modules/cache/services/local-storage/local-storage.types';
import {
	AllBitcoinOracleSettings,
	AllMintDashboardSettings,
	AllMintDatabaseSettings,
	AllMintKeysetsSettings,
	AllMintConfigSettings,
	AllSystemMetricsSettings,
	AllSettingsDeviceSettings,
	AllSettingsAppSettings,
	AllEventLogSettings,
} from '@client/modules/settings/types/setting.types';

@Injectable({
	providedIn: 'root',
})
export class SettingDeviceService {
	public bitcoin_oracle_short_settings: Record<string, number | null> = {
		date_end: null,
	};
	public mint_dashboard_short_settings: Record<string, number | null> = {
		date_end: null,
	};
	public mint_keysets_short_settings: Record<string, number | null> = {
		date_end: null,
	};
	public mint_database_short_settings: Record<string, number | null> = {
		date_end: null,
		page: null,
	};
	public mint_server_short_settings: Record<string, number | null> = {
		date_end: null,
	};
	public event_log_short_settings: Record<string, number | null> = {
		date_end: null,
		page: null,
	};
    public system_metrics_short_settings: Record<string, number | null> = {
		date_end: null,
	};

	/* In-memory cache for frequently accessed settings */
	private cached_locale: string | null = null;
	private cached_timezone: string | null = null;
	private cached_theme: ThemeType | null = null;
	private cached_currency: Currency | null = null;

	constructor(
		private dateAdapter: DateAdapter<Date>,
		private localStorageService: LocalStorageService,
	) {}

	public init(): void {
		this.setLocale();
		this.setTimezone();
		this.setTheme();
	}

	/* Locale */
	public getLocale(): string {
		if (this.cached_locale !== null) return this.cached_locale;
		const system_locale = Intl.DateTimeFormat().resolvedOptions().locale;
		this.cached_locale = this.localStorageService.getLocale().code ?? system_locale;
		return this.cached_locale;
	}
	public setLocale(): void {
		this.cached_locale = null;
		const locale = this.getLocale();
		this.dateAdapter.setLocale(locale);
		Settings.defaultLocale = locale;
	}

	/* Timezone */
	public getTimezone(): string {
		if (this.cached_timezone !== null) return this.cached_timezone;
		const system_timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		this.cached_timezone = this.localStorageService.getTimezone().tz ?? system_timezone;
		return this.cached_timezone;
	}
	public setTimezone(): void {
		this.cached_timezone = null;
		const timezone = this.getTimezone();
		Settings.defaultZone = timezone;
	}

	/* Theme */
	public getTheme(): ThemeType {
		if (this.cached_theme !== null) return this.cached_theme;
		const prefers_light_theme = window.matchMedia('(prefers-color-scheme: light)').matches;
		const theme = this.localStorageService.getTheme();
		this.cached_theme = theme.type === null ? (prefers_light_theme ? ThemeType.LIGHT_MODE : ThemeType.DARK_MODE) : theme.type;
		return this.cached_theme;
	}
	public setTheme(): void {
		this.cached_theme = null;
		const theme = this.getTheme();
		document.body.classList.remove(ThemeType.LIGHT_MODE, ThemeType.DARK_MODE);
		document.body.classList.add(theme);
	}

	/* AI Model */
	public getModel(): string | null {
		return this.localStorageService.getModel().model;
	}
	public setModel(model: string | null): void {
		this.localStorageService.setModel({model: model});
	}

	/* AI Favorites */
	public getAiFavorites(): AiFavorites {
		return this.localStorageService.getAiFavorites();
	}
	public setAiFavorites(favorites: AiFavorites): void {
		this.localStorageService.setAiFavorites(favorites);
	}

	/* Currency */
	public getCurrency(): Currency {
		if (this.cached_currency !== null) return this.cached_currency;
		const currency = this.localStorageService.getCurrency();
		this.cached_currency = currency ?? {type_btc: CurrencyType.GLYPH, type_fiat: CurrencyType.GLYPH};
		return this.cached_currency;
	}
	public setCurrency(): void {
		this.cached_currency = null;
		const currency = this.getCurrency();
		this.localStorageService.setCurrency(currency);
	}

	/* Page: Bitcoin Oracle */
	public getBitcoinOracleSettings(): AllBitcoinOracleSettings {
		const long_term_settings = this.localStorageService.getBitcoinOracleSettings();
		return {
			...long_term_settings,
			...this.bitcoin_oracle_short_settings,
		} as AllBitcoinOracleSettings;
	}
	public setBitcoinOracleSettings(settings: AllBitcoinOracleSettings): void {
		const {date_end, ...long_settings} = settings;
		this.localStorageService.setBitcoinOracleSettings(long_settings);
		this.bitcoin_oracle_short_settings = {
			date_end: date_end,
		};
	}

	/* Page: Mint Dashboard */
	public getMintDashboardSettings(): AllMintDashboardSettings {
		const long_term_settings = this.localStorageService.getMintDashboardSettings();
		return {
			...long_term_settings,
			...this.mint_dashboard_short_settings,
		} as AllMintDashboardSettings;
	}
	public setMintDashboardSettings(settings: AllMintDashboardSettings): void {
		const {date_end, ...long_settings} = settings;
		this.localStorageService.setMintDashboardSettings(long_settings);
		this.mint_dashboard_short_settings = {
			date_end: date_end,
		};
	}

	/* Page: Mint Config */
	public getMintConfigSettings(): AllMintConfigSettings {
		return this.localStorageService.getMintConfigSettings();
	}
	public setMintConfigSettings(settings: AllMintConfigSettings): void {
		this.localStorageService.setMintConfigSettings(settings);
	}

	/* Page: Mint Keysets */
	public getMintKeysetsSettings(): AllMintKeysetsSettings {
		const long_term_settings = this.localStorageService.getMintKeysetsSettings();
		return {
			...long_term_settings,
			...this.mint_keysets_short_settings,
		} as AllMintKeysetsSettings;
	}
	public setMintKeysetsSettings(settings: AllMintKeysetsSettings): void {
		const {date_end, ...long_settings} = settings;
		this.localStorageService.setMintKeysetsSettings(long_settings);
		this.mint_keysets_short_settings = {
			date_end: date_end,
		};
	}

	/* Page: Mint Database */
	public getMintDatabaseSettings(): AllMintDatabaseSettings {
		const long_term_settings = this.localStorageService.getMintDatabaseSettings();
		return {
			...long_term_settings,
			...this.mint_database_short_settings,
		} as AllMintDatabaseSettings;
	}
	public setMintDatabaseSettings(settings: AllMintDatabaseSettings): void {
		const {date_end, page, ...long_settings} = settings;
		this.localStorageService.setMintDatabaseSettings(long_settings);
		this.mint_database_short_settings = {
			date_end: date_end,
			page: page,
		};
	}

	/* Page: Mint System */
	public getMintSystemSettings(): AllSystemMetricsSettings {
		const long_term_settings = this.localStorageService.getMintSystemSettings();
		return {
			...long_term_settings,
			...this.mint_server_short_settings,
		} as AllSystemMetricsSettings;
	}
	public setMintSystemSettings(settings: AllSystemMetricsSettings): void {
		const {date_end, ...long_settings} = settings;
		this.localStorageService.setMintSystemSettings(long_settings);
		this.mint_server_short_settings = {
			date_end: date_end,
		};
	}

	/* Page: Settings App */
	public getSettingsAppSettings(): AllSettingsAppSettings {
		return this.localStorageService.getSettingsAppSettings();
	}
	public setSettingsAppSettings(settings: AllSettingsAppSettings): void {
		this.localStorageService.setSettingsAppSettings(settings);
	}

	/* Page: Settings Device */
	public getSettingsDeviceSettings(): AllSettingsDeviceSettings {
		return this.localStorageService.getSettingsDeviceSettings();
	}
	public setSettingsDeviceSettings(settings: AllSettingsDeviceSettings): void {
		this.localStorageService.setSettingsDeviceSettings(settings);
	}

	/* Page: Event Log */
	public getEventLogSettings(): AllEventLogSettings {
		const long_term_settings = this.localStorageService.getEventLogSettings();
		return {
			...long_term_settings,
			...this.event_log_short_settings,
		} as AllEventLogSettings;
	}
	public setEventLogSettings(settings: AllEventLogSettings): void {
		const {date_end, page, sections, actor_types, actor_ids, types, statuses, ...long_settings} = settings;
		this.localStorageService.setEventLogSettings(long_settings);
		this.event_log_short_settings = {
			date_end: date_end,
			page: page,
		};
	}

    /* Page: System Metrics */
	public getSystemMetricsSettings(): AllSystemMetricsSettings {
		const long_term_settings = this.localStorageService.getSystemMetricsSettings();
		return {
			...long_term_settings,
			...this.system_metrics_short_settings,
		} as AllSystemMetricsSettings;
	}
	public setSystemMetricsSettings(settings: AllSystemMetricsSettings): void {
		const {date_end, ...long_settings} = settings;
		this.localStorageService.setSystemMetricsSettings(long_settings);
		this.system_metrics_short_settings = {
			date_end: date_end,
		};
	}
}
