export const MINT_INFO_QUERY = `{
    mint_info{
        name
        pubkey
        version
        description
        description_long
        icon_url
        urls
        time
		contact{
			method
			info
        }
        nuts{
			nut4{
				disabled
				methods{
					method
					unit
					description
					min_amount
					max_amount
				}
			}
			nut5{
				disabled
				methods{
					method
					unit
					amountless
					min_amount
					max_amount
				}
			}
			nut7{
				supported
			}
			nut8{
				supported
			}
			nut9{
				supported
			}
			nut10{
				supported
			}
			nut11{
				supported
			}
			nut12{
				supported
			}
			nut14{
				supported
			}
			nut15{
				methods{
					method
					unit
				}
			}
			nut17{
				supported{
					method
					unit
					commands
				}
			}
			nut19{
				cached_endpoints{
					method
					path
				}
				ttl
			}
			nut20{
				supported
			}
			nut21{
				openid_discovery
				client_id
				protected_endpoints{
					method
					path
				}
			}
			nut22{
				bat_max_mint
				protected_endpoints{
					method
					path
				}
			}
			nut29{
				max_batch_size
				methods
			}
        }
  	}
}`;

export const MINT_INFO_RPC_QUERY = `{
	mint_info_rpc{
		name
		description
		description_long
		icon_url
		motd
		total_issued
		total_redeemed
		urls
		version
		contact{
			info
			method
		}
	}
}`;

export const MINT_QUOTE_TTLS_QUERY = `{
	mint_quote_ttl{
		melt_ttl
		mint_ttl
	}
}`;

export const MINT_BALANCES_QUERY = `
query MintBalances($keyset_id: String) {
    mint_balances(keyset_id: $keyset_id) {
        balance
    	keyset
    }
}`;

export const MINT_KEYSETS_QUERY = `{
    mint_keysets{
        active
		derivation_path
		derivation_path_index
		id
		input_fee_ppk
		unit
		valid_from
		valid_to
		fees_paid
		amounts
    }
}`;

export const MINT_ANALYTICS_BALANCES_QUERY = `
query MintAnalyticsBalances($units: [MintUnit!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: AnalyticsInterval, $timezone: Timezone) {
	mint_analytics_balances(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone) {
		unit
		amount
		date
	}
}`;

export const MINT_ANALYTICS_MINTS_QUERY = `
query MintAnalyticsMints($units: [MintUnit!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: AnalyticsInterval, $timezone: Timezone) {
	mint_analytics_mints(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone) {
		unit
		amount
		date
	}
}`;

export const MINT_ANALYTICS_MELTS_QUERY = `
query MintAnalyticsMelts($units: [MintUnit!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: AnalyticsInterval, $timezone: Timezone) {
	mint_analytics_melts(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone) {
		unit
		amount
		date
	}
}`;

export const MINT_ANALYTICS_SWAPS_QUERY = `
query MintAnalyticsSwaps($units: [MintUnit!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: AnalyticsInterval, $timezone: Timezone) {
	mint_analytics_swaps(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone) {
		unit
		amount
		date
	}
}`;

export const MINT_ANALYTICS_FEES_QUERY = `
query MintAnalyticsFees($units: [MintUnit!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: AnalyticsInterval, $timezone: Timezone) {
	mint_analytics_fees(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone) {
		unit
		amount
		date
	}
}`;

export const MINT_ANALYTICS_PROOFS_QUERY = `
query MintAnalyticsProofs($units: [MintUnit!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: AnalyticsInterval, $timezone: Timezone) {
	mint_analytics_proofs(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone) {
		unit
		amount
		date
		count
	}
}`;

export const MINT_ANALYTICS_PROMISES_QUERY = `
query MintAnalyticsPromises($units: [MintUnit!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: AnalyticsInterval, $timezone: Timezone) {
	mint_analytics_promises(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone) {
		unit
		amount
		date
		count
	}
}`;

export const MINT_ANALYTICS_BACKFILL_STATUS_QUERY = `{
	mint_analytics_backfill_status {
		is_running
		first_processed_at
		errors
		last_processed_at
		total_streams
		streams_completed
	}
}`;

export const MINT_MINT_QUOTES_QUERY = `
query MintMintQuotes($units: [MintUnit!], $states: [MintQuoteState!], $date_start: UnixTimestamp, $date_end: UnixTimestamp) {
	mint_mint_quotes(units: $units, states: $states, date_start: $date_start, date_end: $date_end) {
		id
		amount
		amount_issued
		unit
		state
		issued_time
		created_time
		payment_method
	}
}`;

export const MINT_MELT_QUOTES_QUERY = `
query MintMeltQuotes($units: [MintUnit!], $states: [MeltQuoteState!], $date_start: UnixTimestamp, $date_end: UnixTimestamp) {
	mint_melt_quotes(units: $units, states: $states, date_start: $date_start, date_end: $date_end) {
		id
		amount
		unit
		state
		created_time
		paid_time
		payment_method
	}
}`;

export const MINT_ANALYTICS_KEYSETS_QUERY = `
query MintAnalyticsKeysets($date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: AnalyticsInterval, $timezone: Timezone) {
	mint_analytics_keysets(date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone) {
		amount
		date
		keyset_id
	}
}`;

export const MINT_KEYSET_COUNTS_QUERY = `
query MintKeysetCounts($date_start: UnixTimestamp, $date_end: UnixTimestamp, $id_keysets: [String!]) {
	mint_keyset_counts(date_start: $date_start, date_end: $date_end, id_keysets: $id_keysets) {
		id
		proof_count
		promise_count
	}
}`;

export const MINT_NAME_MUTATION = `
mutation MintName($name: String) {
	mint_name_update(name: $name) {
		name
	}
}`;

export const MINT_DESCRIPTION_MUTATION = `
mutation MintDescription($description: String!) {
	mint_short_description_update(description: $description) {
		description
	}
}`;

export const MINT_DESCRIPTION_LONG_MUTATION = `
mutation MintDescriptionLong($description: String!) {
	mint_long_description_update(description: $description) {
		description
	}
}`;

export const MINT_ICON_MUTATION = `
mutation MintIcon($icon_url: String!) {
	mint_icon_update(icon_url: $icon_url) {
		icon_url
	}
}`;

export const MINT_MOTD_MUTATION = `
mutation MintMotd($motd: String) {
	mint_motd_update(motd: $motd) {
		motd
	}
}`;

export const MINT_URL_UPDATE_MUTATIONS = `
mutation MintUrlUpdate($url_add: String!, $url_remove: String!) {
	mint_url_add(url: $url_add) {
		url
	}
	mint_url_remove(url: $url_remove) {
		url
	}
}`;

export const MINT_URL_ADD_MUTATION = `
mutation MintUrlAdd($url: String!) {
	mint_url_add(url: $url) {
		url
	}
}`;

export const MINT_URL_REMOVE_MUTATION = `
mutation MintUrlRemove($url: String!) {
	mint_url_remove(url: $url) {
		url
	}
}`;

export const MINT_CONTACT_REMOVE_MUTATION = `
mutation MintContactRemove($method: String!, $info: String!) {
	mint_contact_remove(method: $method, info: $info) {
		method
		info
	}
}`;

export const MINT_CONTACT_ADD_MUTATION = `
mutation MintContactAdd($method: String!, $info: String!) {
	mint_contact_add(method: $method, info: $info) {
		method
		info
	}
}`;

export const MINT_QUOTE_TTL_MUTATION = `
mutation MintQuoteTtl($mint_quote_ttl_update: MintQuoteTtlUpdateInput!) {
	mint_quote_ttl_update(mint_quote_ttl_update: $mint_quote_ttl_update) {
		mint_ttl
		melt_ttl
	}
}`;

export const MINT_NUT04_UPDATE_MUTATION = `
mutation MintNut04Update($unit: String!, $method: String!, $disabled: Boolean, $min_amount: Int, $max_amount: Int, $description: Boolean) {
	mint_nut04_update(unit: $unit, method: $method, disabled: $disabled, min_amount: $min_amount, max_amount: $max_amount, description: $description) {
		unit
		method
		max_amount
		min_amount
		description
		disabled
	}
}`;

export const MINT_NUT05_UPDATE_MUTATION = `
mutation MintNut05Update($unit: String!, $method: String!, $disabled: Boolean, $min_amount: Int, $max_amount: Int) {
	mint_nut05_update(unit: $unit, method: $method, disabled: $disabled, min_amount: $min_amount, max_amount: $max_amount) {
		unit
		method
		max_amount
		min_amount
		disabled
	}
}`;

export const MINT_KEYSETS_ROTATION_MUTATION = `
mutation MintRotateKeyset($unit: String!, $amounts: [Float!], $input_fee_ppk: Int, $keyset_v2: Boolean) {
	mint_rotate_keyset(unit: $unit, amounts: $amounts, input_fee_ppk: $input_fee_ppk, keyset_v2: $keyset_v2) {
		unit
		input_fee_ppk
		amounts
	}
}`;

export const MINT_MINT_QUOTES_DATA_QUERY = `
query MintMintQuotes($units: [MintUnit!], $states: [MintQuoteState!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $page: Int, $page_size: Int) {
	mint_mint_quotes(units: $units, states: $states, date_start: $date_start, date_end: $date_end, page: $page, page_size: $page_size) {
		id
		amount
		unit
		request
		state
		request_lookup_id
		pubkey
		issued_time
		created_time
		paid_time
		amount_paid
		amount_issued
		payment_method
	}
	mint_count_mint_quotes(units: $units, states: $states, date_start: $date_start, date_end: $date_end) {
		count
	}
}`;

export const MINT_MELT_QUOTES_DATA_QUERY = `
query MintMeltQuotes($units: [MintUnit!], $states: [MeltQuoteState!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $page: Int, $page_size: Int) {
	mint_melt_quotes(units: $units, states: $states, date_start: $date_start, date_end: $date_end, page: $page, page_size: $page_size) {
		id
		amount
		unit
		request
		fee_reserve
		state
		payment_preimage
		request_lookup_id
		msat_to_pay
		created_time
		paid_time
		payment_method
	}
	mint_count_melt_quotes(units: $units, states: $states, date_start: $date_start, date_end: $date_end) {
		count
	}
}`;

export const MINT_DATABASE_INFO_QUERY = `{
	mint_database_info {
		size
		type
	}
}`;

export const MINT_DATABASE_BACKUP_MUTATION = `
mutation MintDatabaseBackup {
	mint_database_backup {
		filebase64
	}
}`;

export const MINT_DATABASE_RESTORE_MUTATION = `
mutation MintDatabaseRestore($filebase64: Base64!) {
	mint_database_restore(filebase64: $filebase64) {
		success
	}
}`;

export const MINT_PROOF_GROUP_STATS_QUERY = `
query MintProofGroupStats($unit: MintUnit!) {
	mint_proof_group_stats(unit: $unit) {
		median
	}
}`;

export const MINT_WATCHDOG_STATUS_QUERY = `
query MintWatchdogStatus {
	mint_watchdog_status {
		is_alive
		last_seen
	}
}`;

export const MINT_NUT04_QUOTE_UPDATE_MUTATION = `
mutation MintNut04QuoteUpdate($quote_id: String!, $state: String!) {
	mint_nut04_quote_update(quote_id: $quote_id, state: $state) {
		quote_id
		state
	}
}`;

export const MINT_NUT05_QUOTE_UPDATE_MUTATION = `
mutation MintNut05QuoteUpdate($quote_id: String!, $state: String!) {
	mint_nut05_quote_update(quote_id: $quote_id, state: $state) {
		quote_id
		state
	}
}`;

export const MINT_ACTIVITY_SUMMARY_QUERY = `
query MintActivitySummary($period: MintActivityPeriod!, $timezone: Timezone) {
	mint_activity_summary(period: $period, timezone: $timezone) {
		total_operations
		total_operations_delta
		total_volume
		total_volume_delta
		mint_count
		mint_count_delta
		mint_sparkline { created_time amount }
		melt_count
		melt_count_delta
		melt_sparkline { created_time amount }
		swap_count
		swap_count_delta
		swap_sparkline { created_time amount }
		mint_completed_pct
		mint_completed_pct_delta
		mint_avg_time
		mint_avg_time_delta
		melt_completed_pct
		melt_completed_pct_delta
		melt_avg_time
		melt_avg_time_delta
		warnings
	}
}`;

export const MINT_SWAPS_DATA_QUERY = `
query MintSwaps($units: [MintUnit!], $id_keysets: [String!], $date_start: UnixTimestamp, $date_end: UnixTimestamp, $page: Int, $page_size: Int) {
	mint_swaps(units: $units, id_keysets: $id_keysets, date_start: $date_start, date_end: $date_end, page: $page, page_size: $page_size) {
		operation_id
		keyset_ids
		unit
		amount
		created_time
		fee
	}
	mint_count_swaps(units: $units, id_keysets: $id_keysets, date_start: $date_start, date_end: $date_end) {
		count
	}
}`;
