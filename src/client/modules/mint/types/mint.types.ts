import {
	OrchardMintBalance,
	OrchardMintInfo,
	OrchardMintQuoteTtls,
	OrchardMintKeyset,
	OrchardMintAnalytics,
	OrchardMintMintQuote,
	OrchardMintMeltQuote,
	OrchardMintSwap,
	OrchardMintKeysetsAnalytics,
	OrchardMintActivitySummary,
	MintUnit,
	AnalyticsInterval,
	OrchardAnalyticsBackfillStatus,
	MintQuoteState,
	MeltQuoteState,
	OrchardMintInfoRpc,
	OrchardMintCount,
	OrchardMintNameUpdate,
	OrchardMintIconUpdate,
	OrchardMintDescriptionUpdate,
	OrchardMintMotdUpdate,
	OrchardMintUrlUpdate,
	OrchardMintContactUpdate,
	OrchardMintNut04Update,
	OrchardMintNut05Update,
	OrchardMintNut04QuoteUpdate,
	OrchardMintNut05QuoteUpdate,
	OrchardMintKeysetRotation,
	OrchardMintDatabaseBackup,
	OrchardMintDatabaseInfo,
	OrchardMintDatabaseRestore,
	OrchardMintProofGroupStats,
	OrchardMintWatchdogStatus,
	OrchardMintKeysetCount,
} from '@shared/generated.types';

export type MintActivitySummaryResponse = {
	mint_activity_summary: OrchardMintActivitySummary;
};

export type MintInfoResponse = {
	mint_info: OrchardMintInfo;
};

export type MintInfoRpcResponse = {
	mint_info_rpc: OrchardMintInfoRpc;
};

export type MintQuoteTtlsResponse = {
	mint_quote_ttl: OrchardMintQuoteTtls;
};

export type MintBalancesResponse = {
	mint_balances: OrchardMintBalance[];
	errors?: string[];
};

export type MintKeysetsResponse = {
	mint_keysets: OrchardMintKeyset[];
};

export type MintAnalyticsBalancesResponse = {
	mint_analytics_balances: OrchardMintAnalytics[];
};

export type MintAnalyticsMintsResponse = {
	mint_analytics_mints: OrchardMintAnalytics[];
};

export type MintAnalyticsMeltsResponse = {
	mint_analytics_melts: OrchardMintAnalytics[];
};

export type MintAnalyticsSwapsResponse = {
	mint_analytics_swaps: OrchardMintAnalytics[];
};

export type MintSwapsDataResponse = {
	mint_swaps: OrchardMintSwap[];
	mint_count_swaps: OrchardMintCount;
};

export type MintAnalyticsFeesResponse = {
	mint_analytics_fees: OrchardMintAnalytics[];
};

export type MintMintQuotesResponse = {
	mint_mint_quotes: OrchardMintMintQuote[];
};

export type MintMeltQuotesResponse = {
	mint_melt_quotes: OrchardMintMeltQuote[];
};

export type MintAnalyticsProofsResponse = {
	mint_analytics_proofs: OrchardMintAnalytics[];
};

export type MintAnalyticsPromisesResponse = {
	mint_analytics_promises: OrchardMintAnalytics[];
};

export type MintAnalyticsBackfillStatusResponse = {
	mint_analytics_backfill_status: OrchardAnalyticsBackfillStatus;
};

export type MintAnalyticsKeysetsResponse = {
	mint_analytics_keysets: OrchardMintKeysetsAnalytics[];
};

export type MintKeysetCountsResponse = {
	mint_keyset_counts: OrchardMintKeysetCount[];
};

export type MintAnalyticsArgs = {
	units?: MintUnit[];
	date_start?: number;
	date_end?: number;
	interval?: AnalyticsInterval;
	timezone?: string;
};

export type MintMintQuotesArgs = {
	units?: MintUnit[];
	date_start?: number;
	date_end?: number;
	states?: MintQuoteState[];
	page?: number;
	page_size?: number;
};

export type MintMeltQuotesArgs = {
	units?: MintUnit[];
	date_start?: number;
	date_end?: number;
	states?: MeltQuoteState[];
	page?: number;
	page_size?: number;
};

export type MintSwapsArgs = {
	units?: MintUnit[];
	id_keysets?: string[];
	date_start?: number;
	date_end?: number;
	page?: number;
	page_size?: number;
};

export type MintKeysetCountsArgs = {
	date_start?: number;
	date_end?: number;
	id_keysets?: string[];
};

export type MintNameUpdateResponse = {
	mint_name_update: OrchardMintNameUpdate;
};

export type MintDescriptionUpdateResponse = {
	mint_short_description_update: OrchardMintDescriptionUpdate;
};

export type MintDescriptionLongUpdateResponse = {
	mint_long_description_update: OrchardMintDescriptionUpdate;
};

export type MintIconUrlUpdateResponse = {
	mint_icon_update: OrchardMintIconUpdate;
};

export type MintMotdUpdateResponse = {
	mint_motd_update: OrchardMintMotdUpdate;
};

export type MintUrlUpdateResponse = {
	mint_url_add: OrchardMintUrlUpdate;
	mint_url_remove: OrchardMintUrlUpdate;
};

export type MintUrlAddResponse = {
	mint_url_add: OrchardMintUrlUpdate;
};

export type MintUrlRemoveResponse = {
	mint_url_remove: OrchardMintUrlUpdate;
};

export type MintContactUpdateResponse = {
	mint_contact_add: OrchardMintContactUpdate;
	mint_contact_remove: OrchardMintContactUpdate;
};

export type MintContactRemoveResponse = {
	mint_contact_remove: OrchardMintContactUpdate;
};

export type MintContactAddResponse = {
	mint_contact_add: OrchardMintContactUpdate;
};

export type MintQuoteTtlUpdateResponse = {
	mint_quote_ttl_update: OrchardMintQuoteTtls;
};

export type MintNut04UpdateResponse = {
	mint_nut04_update: OrchardMintNut04Update;
};

export type MintNut05UpdateResponse = {
	mint_nut05_update: OrchardMintNut05Update;
};

export type MintKeysetRotationResponse = {
	mint_keysets_rotation: OrchardMintKeysetRotation;
};

export type MintMintQuotesDataResponse = {
	mint_mint_quotes: OrchardMintMintQuote[];
	mint_count_mint_quotes: OrchardMintCount;
};

export type MintMeltQuotesDataResponse = {
	mint_melt_quotes: OrchardMintMeltQuote[];
	mint_count_melt_quotes: OrchardMintCount;
};

export type MintDatabaseInfoResponse = {
	mint_database_info: OrchardMintDatabaseInfo;
};

export type MintDatabaseBackupResponse = {
	mint_database_backup: OrchardMintDatabaseBackup;
};

export type MintDatabaseRestoreResponse = {
	mint_database_restore: OrchardMintDatabaseRestore;
};

export type MintProofGroupStatsResponse = {
	mint_proof_group_stats: OrchardMintProofGroupStats;
};

export type MintWatchdogStatusResponse = {
	mint_watchdog_status: OrchardMintWatchdogStatus;
};

export type MintNut04QuoteUpdateResponse = {
	mint_nut04_quote_update: OrchardMintNut04QuoteUpdate;
};

export type MintNut05QuoteUpdateResponse = {
	mint_nut05_quote_update: OrchardMintNut05QuoteUpdate;
};
