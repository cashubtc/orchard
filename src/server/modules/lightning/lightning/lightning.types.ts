import {LightningRequestType, LightningChannelCloseType, LightningChannelOpenInitiator} from '#server/modules/lightning/lightning.enums';

export type LightningInfo = {
	version: string;
	commit_hash: string;
	identity_pubkey: string;
	alias: string;
	color: string;
	num_pending_channels: number;
	num_active_channels: number;
	num_inactive_channels: number;
	num_peers: number;
	block_height: number;
	block_hash: string;
	best_header_timestamp: number;
	synced_to_chain: boolean;
	synced_to_graph: boolean;
	testnet: boolean;
	chains: {chain: string; network: string}[];
	uris: string[];
	require_htlc_interceptor: boolean;
	store_final_htlc_resolutions: boolean;
	features: {[key: string]: {name: string; is_required: boolean; is_known: boolean}};
};

export type LightningChannelBalance = {
	balance: string;
	pending_open_balance: string;
	local_balance: string;
	remote_balance: string;
	unsettled_local_balance: string;
	unsettled_remote_balance: string;
	pending_open_local_balance: string;
	pending_open_remote_balance: string;
	custom_channel_data: Buffer;
};

export type LightningCustomChannels = {
	open_channels: {[key: string]: {asset_id: string; name: string; local_balance: number; remote_balance: number}};
	pending_channels: {[key: string]: {asset_id: string; name: string; local_balance: number; remote_balance: number}};
};

export type LightningRequest = {
	type: LightningRequestType;
	valid: boolean;
	destination: string | null;
	expiry: number | null;
	description: string | null;
	offer_quantity_max: number | null;
};

/* ============================================
   Common Lightning Types for Analytics
   These abstract differences between LND and CLN
   ============================================ */

/**
 * Taproot Asset balance in an HTLC (from custom_channel_data)
 */
export type LightningAssetBalance = {
	asset_id: string;
	amount: string; // in asset's smallest unit
};

/**
 * Taproot Asset channel data (parsed from custom_channel_data)
 */
export type LightningChannelAsset = {
	group_key: string;
	asset_id: string;
	name: string;
	local_balance: string;
	remote_balance: string;
	capacity: string;
	decimal_display: number;
};

/**
 * Common payment type (outgoing payments)
 * Nullable fields indicate data that may not be available from all backends
 */
export type LightningPayment = {
	payment_hash: string;
	value_msat: string;
	fee_msat: string;
	status: 'pending' | 'succeeded' | 'failed';
	creation_time: number; // seconds since epoch
	asset_balances: LightningAssetBalance[]; // Taproot Asset amounts (empty for BTC-only)
};

/**
 * Common invoice type (incoming payments)
 */
export type LightningInvoice = {
	payment_hash: string;
	value_msat: string;
	amt_paid_msat: string;
	state: 'open' | 'settled' | 'canceled' | 'accepted';
	creation_date: number; // seconds since epoch
	settle_date: number | null; // seconds since epoch (if settled)
	asset_balances: LightningAssetBalance[]; // Taproot Asset amounts (empty for BTC-only)
};

/**
 * Common forwarding event type (routing fees earned)
 */
export type LightningForward = {
	timestamp: number; // seconds since epoch
	amt_in_msat: string;
	amt_out_msat: string;
	fee_msat: string;
};

/**
 * Common open channel type
 */
export type LightningChannel = {
	channel_point: string; // funding txid:index
	chan_id: string;
	capacity: string; // total channel capacity (sats)
	local_balance: string; // current local balance (sats)
	remote_balance: string; // current remote balance (sats)
	initiator: boolean | null; // true if we opened (CLN may not have this for old channels)
	push_amount_sat: string | null; // amount pushed on open (may not be available)
	private: boolean;
	active: boolean;
	remote_pubkey: string; // peer public key
	peer_alias: string | null; // peer alias (LND only via peer_alias_lookup)
	funding_txid: string; // for timestamp lookup
	asset: LightningChannelAsset | null; // Taproot Asset data (null for regular BTC channels)
};

/**
 * Common closed channel type
 */
export type LightningClosedChannel = {
	channel_point: string;
	chan_id: string;
	capacity: string;
	close_height: number; // block height of close (need to convert to timestamp)
	settled_balance: string; // what we got back (sats)
	time_locked_balance: string | null;
	close_type: LightningChannelCloseType;
	open_initiator: LightningChannelOpenInitiator;
	remote_pubkey: string; // peer public key
	funding_txid: string; // for open timestamp lookup
	closing_txid: string; // for close timestamp lookup
	asset: LightningChannelAsset | null; // Taproot Asset data (null for regular BTC channels)
};

/**
 * Common peer type
 */
export type LightningPeer = {
	pubkey: string;
	alias: string | null; // resolved via GetNodeInfo (LND) / ListNodes (CLN)
	address: string;
	bytes_sent: string | null; // null when backend doesn't expose (CLN)
	bytes_recv: string | null;
	sat_sent: string | null;
	sat_recv: string | null;
	inbound: boolean | null;
	ping_time: number | null;
};

/**
 * Common transaction type for on-chain wallet transactions
 */
export type LightningTransaction = {
	tx_hash: string;
	time_stamp: number; // seconds since epoch
	amount: string | null; // signed sats (positive=receive, negative=send). null if unavailable (CLN)
	total_fees: string | null; // on-chain fees in sats. null if unavailable (CLN)
	block_height?: number; // optional, used for enrichment from Bitcoin RPC
};

/**
 * Arguments for fetching historical lightning data
 */
export type LightningHistoryArgs = {
	start_time?: number; // unix timestamp in seconds
	end_time?: number; // unix timestamp in seconds
	index_offset?: number;
	max_results?: number;
};

/**
 * Paginated result wrapper for Lightning history queries.
 * LND uses non-sequential indices (payment_index, add_index, etc.),
 * so callers must use last_offset to advance pagination rather than batch length.
 */
export type LightningPaginatedResult<T> = {
	data: T[];
	last_offset: number; // last index in the result set — use as next index_offset
};
