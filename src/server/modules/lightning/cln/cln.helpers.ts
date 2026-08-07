/* Application Dependencies */
import {LightningRequestType, LightningChannelCloseType, LightningChannelOpenInitiator} from '#server/modules/lightning/lightning.enums';
import {
	LightningPayment,
	LightningInvoice,
	LightningForward,
	LightningChannel,
	LightningClosedChannel,
	LightningTransaction,
	LightningPaginatedResult,
	LightningPeer,
} from '#server/modules/lightning/lightning/lightning.types';
/* Local Dependencies */
import {
	ClnPay,
	ClnPayStatus,
	ClnInvoice,
	ClnInvoiceStatus,
	ClnForward,
	ClnForwardStatus,
	ClnChannel,
	ClnChannelSide,
	ClnClosedChannel,
	ClnCloseCause,
	ClnTransaction,
	ClnListPaysResponse,
	ClnListInvoicesResponse,
	ClnListForwardsResponse,
	ClnListPeerChannelsResponse,
	ClnListClosedChannelsResponse,
	ClnListTransactionsResponse,
	ClnPeer,
	ClnListPeersResponse,
} from './cln.types.js';

export function asBigIntMsat(v: any): bigint {
	if (v == null) return BigInt(0);
	if (typeof v === 'object' && 'msat' in v) v = v.msat;
	if (typeof v === 'string') return BigInt(v);
	if (typeof v === 'number') return BigInt(Math.trunc(v));
	try {
		return BigInt(v);
	} catch {
		return BigInt(0);
	}
}

export function msatToStrings(msatLike: any): {sat: string; msat: string} {
	const msat = asBigIntMsat(msatLike);
	return {sat: (msat / BigInt(1000)).toString(), msat: msat.toString()};
}

export function sumMsat(items: any[], selector: (x: any) => any): bigint {
	let total = BigInt(0);
	for (const it of items || []) total += asBigIntMsat(selector(it));
	return total;
}

export function mapRequestExpiry(request: any): number {
	if (request?.offer_absolute_expiry) return Number(request.offer_absolute_expiry);
	if (request?.expiry) return Number(request?.created_at) + Number(request.expiry);
	return null;
}

export function mapRequestDescription(description: string | null): string | null {
	if (!description) return null;
	if (description === '') return null;
	return description;
}

export function mapRequestType(type: string): LightningRequestType {
	switch (type) {
		case 'BOLT12_OFFER':
			return LightningRequestType.BOLT12_OFFER;
		case 'BOLT12_INVOICE':
			return LightningRequestType.BOLT12_INVOICE;
		case 'BOLT12_INVOICE_REQUEST':
			return LightningRequestType.BOLT12_INVOICE_REQUEST;
		case 'BOLT11_INVOICE':
			return LightningRequestType.BOLT11_INVOICE;
		default:
			return LightningRequestType.UNKNOWN;
	}
}

/* ============================================
   CLN to Common Type Mapping Helpers
   ============================================ */

/**
 * Converts Buffer to hex string
 */
function bufferToHex(buf: Buffer | undefined): string {
	if (!buf || !Buffer.isBuffer(buf)) return '';
	return buf.toString('hex');
}

/**
 * Extracts msat value as string from CLN Amount object
 */
function extractMsat(amount: {msat: string} | undefined): string {
	return amount?.msat ?? '0';
}

/**
 * Maps CLN payment status to common status
 */
function mapClnPaymentStatus(status: ClnPayStatus): LightningPayment['status'] {
	switch (status) {
		case ClnPayStatus.COMPLETE:
			return 'succeeded';
		case ClnPayStatus.FAILED:
			return 'failed';
		case ClnPayStatus.PENDING:
		default:
			return 'pending';
	}
}

/**
 * Maps CLN ListPaysResponse to common LightningPayment[] with pagination info
 * Note: CLN does not support Taproot Assets, so asset_balances is always empty
 * CLN uses sequential position-based offsets, so last_offset = start + count
 */
export function mapClnPayments(response: ClnListPaysResponse, index_offset: number = 0): LightningPaginatedResult<LightningPayment> {
	const pays = response?.pays ?? [];
	return {
		data: pays.map((p: ClnPay) => ({
			payment_hash: bufferToHex(p.payment_hash),
			value_msat: extractMsat(p.amount_msat),
			fee_msat: (BigInt(extractMsat(p.amount_sent_msat)) - BigInt(extractMsat(p.amount_msat))).toString(),
			status: mapClnPaymentStatus(p.status),
			creation_time: Number(p.created_at) || 0,
			asset_balances: [], // CLN does not support Taproot Assets
		})),
		last_offset: index_offset + pays.length,
	};
}

/**
 * Maps CLN invoice status to common state
 */
function mapClnInvoiceState(status: ClnInvoiceStatus): LightningInvoice['state'] {
	switch (status) {
		case ClnInvoiceStatus.PAID:
			return 'settled';
		case ClnInvoiceStatus.EXPIRED:
			return 'canceled';
		case ClnInvoiceStatus.UNPAID:
		default:
			return 'open';
	}
}

/**
 * Maps CLN ListInvoicesResponse to common LightningInvoice[] with pagination info
 * Note: CLN does not support Taproot Assets, so asset_balances is always empty
 * CLN uses sequential position-based offsets, so last_offset = start + count
 */
export function mapClnInvoices(response: ClnListInvoicesResponse, index_offset: number = 0): LightningPaginatedResult<LightningInvoice> {
	const invoices = response?.invoices ?? [];
	return {
		data: invoices.map((i: ClnInvoice) => ({
			payment_hash: bufferToHex(i.payment_hash),
			value_msat: extractMsat(i.amount_msat),
			amt_paid_msat: extractMsat(i.amount_received_msat),
			state: mapClnInvoiceState(i.status),
			creation_date: Number(i.created_index) || 0, // CLN doesn't have creation_date directly, use created_index or expires_at - expiry
			settle_date: i.paid_at ? Number(i.paid_at) : null,
			asset_balances: [], // CLN does not support Taproot Assets
		})),
		last_offset: index_offset + invoices.length,
	};
}

/**
 * Maps CLN ListForwardsResponse to common LightningForward[] with pagination info
 * Only includes SETTLED forwards (completed routing events)
 * CLN uses sequential position-based offsets, so last_offset = start + count
 */
export function mapClnForwards(response: ClnListForwardsResponse, index_offset: number = 0): LightningPaginatedResult<LightningForward> {
	const forwards = response?.forwards ?? [];
	const data = forwards
		.filter((f: ClnForward) => f.status === ClnForwardStatus.SETTLED)
		.map((f: ClnForward) => ({
			timestamp: Math.floor(Number(f.received_time) || 0),
			amt_in_msat: extractMsat(f.in_msat),
			amt_out_msat: extractMsat(f.out_msat),
			fee_msat: extractMsat(f.fee_msat),
		}));
	return {
		data,
		last_offset: index_offset + forwards.length,
	};
}

/**
 * Extracts funding txid from CLN channel (Buffer to hex)
 */
function extractClnFundingTxid(funding_txid: Buffer | undefined): string {
	if (!funding_txid || !Buffer.isBuffer(funding_txid)) return '';
	// CLN returns txid in internal byte order, need to reverse for display
	return Buffer.from(funding_txid).reverse().toString('hex');
}

/**
 * Maps CLN channel opener to boolean (true = we opened)
 */
function mapClnOpener(opener: ClnChannelSide): boolean {
	return opener === ClnChannelSide.LOCAL;
}

/**
 * Maps CLN ListPeerChannelsResponse to common LightningChannel[]
 * Note: CLN does not support Taproot Assets, so asset is always null
 */
export function mapClnChannels(response: ClnListPeerChannelsResponse): LightningChannel[] {
	const channels = response?.channels ?? [];
	return channels.map((c: ClnChannel) => ({
		channel_point: `${extractClnFundingTxid(c.funding_txid)}:${c.funding_outnum ?? 0}`,
		chan_id: c.short_channel_id ?? '',
		capacity: (BigInt(extractMsat(c.total_msat)) / BigInt(1000)).toString(),
		local_balance: (BigInt(extractMsat(c.to_us_msat)) / BigInt(1000)).toString(),
		remote_balance: ((BigInt(extractMsat(c.total_msat)) - BigInt(extractMsat(c.to_us_msat))) / BigInt(1000)).toString(),
		initiator: mapClnOpener(c.opener),
		push_amount_sat: c.funding?.pushed_msat ? (BigInt(extractMsat(c.funding.pushed_msat)) / BigInt(1000)).toString() : null,
		private: c.private ?? false,
		active: c.peer_connected ?? false,
		remote_pubkey: bufferToHex(c.peer_id),
		peer_alias: null, // CLN does not provide alias on channels
		funding_txid: extractClnFundingTxid(c.funding_txid),
		asset: null, // CLN does not support Taproot Assets
	}));
}

/**
 * Maps CLN close cause to common close type
 */
function mapClnCloseType(close_cause: ClnCloseCause): LightningChannelCloseType {
	switch (close_cause) {
		case ClnCloseCause.LOCAL:
		case ClnCloseCause.USER:
			return LightningChannelCloseType.LOCAL_FORCE;
		case ClnCloseCause.REMOTE:
			return LightningChannelCloseType.REMOTE_FORCE;
		case ClnCloseCause.PROTOCOL:
			return LightningChannelCloseType.COOPERATIVE;
		case ClnCloseCause.ONCHAIN:
			return LightningChannelCloseType.BREACH;
		case ClnCloseCause.UNKNOWN:
		default:
			return LightningChannelCloseType.UNKNOWN;
	}
}

/**
 * Maps CLN opener to common initiator string
 */
function mapClnInitiator(opener: ClnChannelSide): LightningChannelOpenInitiator {
	switch (opener) {
		case ClnChannelSide.LOCAL:
			return LightningChannelOpenInitiator.LOCAL;
		case ClnChannelSide.REMOTE:
			return LightningChannelOpenInitiator.REMOTE;
		default:
			return LightningChannelOpenInitiator.UNKNOWN;
	}
}

/**
 * Maps CLN ListClosedChannelsResponse to common LightningClosedChannel[]
 * Note: CLN does not support Taproot Assets, so asset is always null
 */
export function mapClnClosedChannels(response: ClnListClosedChannelsResponse): LightningClosedChannel[] {
	const channels = response?.closedchannels ?? [];
	return channels.map((c: ClnClosedChannel) => ({
		channel_point: `${extractClnFundingTxid(c.funding_txid)}:${c.funding_outnum ?? 0}`,
		chan_id: c.short_channel_id ?? '',
		capacity: (BigInt(extractMsat(c.total_msat)) / BigInt(1000)).toString(),
		close_height: 0, // CLN doesn't provide close_height directly
		settled_balance: (BigInt(extractMsat(c.final_to_us_msat)) / BigInt(1000)).toString(),
		time_locked_balance: null, // CLN doesn't track this separately
		close_type: mapClnCloseType(c.close_cause),
		open_initiator: mapClnInitiator(c.opener),
		remote_pubkey: c.peer_id ? bufferToHex(c.peer_id) : '',
		funding_txid: extractClnFundingTxid(c.funding_txid),
		closing_txid: c.last_commitment_txid ? extractClnFundingTxid(c.last_commitment_txid) : '',
		asset: null, // CLN does not support Taproot Assets
	}));
}

/**
 * Maps CLN ListTransactionsResponse to common LightningTransaction[]
 */
export function mapClnTransactions(response: ClnListTransactionsResponse): LightningTransaction[] {
	const transactions = response?.transactions ?? [];
	return transactions.map((t: ClnTransaction) => ({
		tx_hash: bufferToHex(Buffer.from(t.hash).reverse()), // Reverse for display order
		time_stamp: 0, // Will be enriched from Bitcoin RPC or estimated
		amount: null, // CLN ListTransactions doesn't provide wallet-relative amounts
		total_fees: null, // CLN ListTransactions doesn't provide fee data
		block_height: t.blockheight ?? undefined,
	}));
}

/**
 * Maps CLN ListPeersResponse to common LightningPeer[]
 * Note: CLN peers have limited bandwidth/satoshi stats compared to LND
 */
export function mapClnPeers(response: ClnListPeersResponse): LightningPeer[] {
	const peers = response?.peers ?? [];
	return peers.map((p: ClnPeer) => ({
		pubkey: bufferToHex(p.id),
		alias: null, // enriched in peer service via ListNodes
		address: p.netaddr?.[0] ?? p.remote_addr ?? '',
		bytes_sent: null, // CLN does not expose byte counters
		bytes_recv: null,
		sat_sent: null, // CLN does not expose sat counters on peers
		sat_recv: null,
		inbound: null, // CLN does not distinguish inbound peers
		ping_time: null, // CLN does not expose ping time
	}));
}
