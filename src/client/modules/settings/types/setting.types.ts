/* Application Dependencies */
import {
	BitcoinOracleSettings,
	MintDashboardSettings,
	MintServerSettings,
	MintKeysetsSettings,
	MintDatabaseSettings,
	MintConfigSettings,
	SettingsDeviceSettings,
	SettingsAppSettings,
	EventLogSettings,
} from '@client/modules/cache/services/local-storage/local-storage.types';
/* Shared Dependencies */
import {EventLogSection, EventLogActorType, EventLogType, EventLogStatus} from '@shared/generated.types';

/* Page: Bitcoin Oracle */
export type AllBitcoinOracleSettings = BitcoinOracleSettings & {
	date_end: number | null;
};
export type NonNullableBitcoinOracleSettings = {
	[K in keyof Omit<AllBitcoinOracleSettings, 'date_preset'>]: NonNullable<AllBitcoinOracleSettings[K]>;
} & Pick<AllBitcoinOracleSettings, 'date_preset'>;

/* Page: Mint Dashboard */
export type AllMintDashboardSettings = MintDashboardSettings & {
	date_end: number | null;
};
export type NonNullableMintDashboardSettings = {
	[K in keyof Omit<AllMintDashboardSettings, 'date_preset'>]: NonNullable<AllMintDashboardSettings[K]>;
} & Pick<AllMintDashboardSettings, 'date_preset'>;

/* Page: Mint Config */
export type AllMintConfigSettings = MintConfigSettings;
export type NonNullableMintConfigSettings = {
	[K in keyof MintConfigSettings]: NonNullable<MintConfigSettings[K]>;
};

/* Page: Mint Keysets */
export type AllMintKeysetsSettings = MintKeysetsSettings & {
	date_end: number | null;
};
export type NonNullableMintKeysetsSettings = {
	[K in keyof Omit<AllMintKeysetsSettings, 'date_preset'>]: NonNullable<AllMintKeysetsSettings[K]>;
} & Pick<AllMintKeysetsSettings, 'date_preset'>;

/* Page: Mint Database */
export type AllMintDatabaseSettings = MintDatabaseSettings & {
	date_end: number | null;
	page: number | null;
	page_size: number | null;
};
export type NonNullableMintDatabaseSettings = {
	[K in keyof Omit<AllMintDatabaseSettings, 'date_preset'>]: NonNullable<AllMintDatabaseSettings[K]>;
} & Pick<AllMintDatabaseSettings, 'date_preset'>;

/* Page: Mint Server */
export type AllMintServerSettings = MintServerSettings & {
	date_end: number | null;
};
export type NonNullableMintServerSettings = {
	[K in keyof Omit<AllMintServerSettings, 'date_preset'>]: NonNullable<AllMintServerSettings[K]>;
} & Pick<AllMintServerSettings, 'date_preset'>;

/* Page: Settings App */
export type AllSettingsAppSettings = SettingsAppSettings;
export type NonNullableSettingsAppSettings = {
	[K in keyof AllSettingsAppSettings]: NonNullable<AllSettingsAppSettings[K]>;
};

/* Page: Settings Device */
export type AllSettingsDeviceSettings = SettingsDeviceSettings;
export type NonNullableSettingsDeviceSettings = {
	[K in keyof AllSettingsDeviceSettings]: NonNullable<AllSettingsDeviceSettings[K]>;
};

/* Page: Event Log */
export type AllEventLogSettings = EventLogSettings & {
	sections: EventLogSection[];
	actor_types: EventLogActorType[];
	actor_ids: string[];
	types: EventLogType[];
	statuses: EventLogStatus[];
	date_end: number | null;
	page: number | null;
};
