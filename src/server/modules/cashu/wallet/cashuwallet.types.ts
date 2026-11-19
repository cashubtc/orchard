/* Vendor Dependencies */
import type {MintInfo, MintQuoteBaseResponse, MintQuoteState} from '@cashu/cashu-ts';
/* Local Dependencies */
import type {CashuWalletMint} from './mint/cashuwalletmint.entity.js';
import type {CashuWalletSeed} from './seed/cashuwalletseed.entity.js';
import type {CashuWalletOperation} from './saga/cashuwalletoperation.entity.js';
import type {CashuWalletMintQuote} from './mintquote/cashuwalletmintquote.entity.js';
import type {WalletMintMatch, WalletOperationState, WalletOperationType} from './cashuwallet.enums.js';

export type CashuWalletBalance = {
	mint_id: string;
	unit: string;
	balance: number;
};

export type CashuWalletOperationFilters = {
	date_start?: number;
	date_end?: number;
	units?: string[];
	mint_ids?: string[];
	methods?: string[];
	states?: WalletOperationState[];
	types?: WalletOperationType[];
	page?: number;
	page_size?: number;
};

export type CashuWalletMintQuoteResponse = MintQuoteBaseResponse & {
	state?: MintQuoteState;
	expiry?: number | null;
};

export type CashuWalletSeedStatus = Pick<CashuWalletSeed, 'created_at' | 'backed_up_at'>;

export type CashuWalletMintRequest = {
	user_id: string;
	mint_id: string;
	type: WalletOperationType.MINT | WalletOperationType.ISSUE;
	unit: string;
	amount: number;
	method: string;
	quote_id: string;
	quote_counter: number | null;
	memo: string | null;
};

export type CashuWalletIssueRequest = {
	user_id: string;
	unit: string;
	amount: number;
	memo: string | null;
};

/** The wallets a pass covers: one user's, or one user's mint, or everyone's when empty */
export type CashuWalletScope = Partial<Pick<CashuWalletOperation, 'user_id' | 'mint_id'>>;

/** A request to receive at a wallet mint: amount null for any amount, description null for none */
export type CashuWalletMintQuoteRequest = {
	user_id: string;
	mint_id: string;
	method: string;
	unit: string;
	amount: number | null;
	description: string | null;
};

/** A mint quote with what its payments brought in (the total minted from it and how many mints that took), and whether it's done receiving */
export type CashuWalletMintQuoteRecord = CashuWalletMintQuote & {
	received: number;
	payments: number;
	final: boolean;
};

export type CashuWalletWatch = {
	operation: CashuWalletOperation;
	release: () => void;
};

export type CashuWalletMintQuoteWatch = {
	quote: CashuWalletMintQuoteRecord;
	release: () => void;
};

/** A wallet operation as announced on change, without the ecash it carries */
export type CashuWalletOperationUpdate = Omit<CashuWalletOperation, 'token' | 'preview' | 'inputs'>;

export type CashuWalletSendRequest = {
	user_id: string;
	mint_id: string;
	unit: string;
	amount: number;
	memo: string | null;
};

/** What spending costs on top of an amount, the total, and whether the balance covers it */
export type CashuWalletSpendEstimate = {
	fee: number;
	total: number;
	sufficient: boolean;
};

/** A request to price a token send: amount null only with max, which asks for the most the wallet can send */
export type CashuWalletSendTokenPreviewRequest = Pick<CashuWalletSendRequest, 'user_id' | 'mint_id' | 'unit'> & {
	amount: number | null;
	max: boolean;
};

/** What sending a token would cost before anything is reserved, the redeemer's fee included */
export type CashuWalletSendTokenPreview = CashuWalletSpendEstimate & {
	amount: number;
	balance: number;
};

/** A request for a melt quote from a wallet mint: amount in the unit, null when the request sets it; max asks for the most the wallet can pay */
export type CashuWalletMeltQuoteRequest = {
	user_id: string;
	mint_id: string;
	method: string;
	unit: string;
	request: string;
	amount: number | null;
	max: boolean;
};

/** What a mint holds back to pay a melt quote one way: a Lightning quote has one way, an onchain quote one per speed */
export type CashuWalletMeltQuoteReserve = {
	fee_index: number | null;
	estimated_blocks: number | null;
	fee_reserve: number;
};

/** A melt quote as the wallet reads it from the mint */
export type CashuWalletMeltQuote = {
	quote_id: string;
	amount: number;
	expiry: number | null;
	reserves: CashuWalletMeltQuoteReserve[];
};

/** What paying a melt quote one way costs from the wallet */
export type CashuWalletMeltQuoteFee = Pick<CashuWalletMeltQuoteReserve, 'fee_index' | 'estimated_blocks'> & CashuWalletSpendEstimate;

/** A melt quote priced against the wallet's balance at its mint */
export type CashuWalletMeltQuoteRecord = Omit<CashuWalletMeltQuote, 'reserves'> & {
	balance: number;
	fees: CashuWalletMeltQuoteFee[];
};

/** A token before it's received: amount is before the fee; fee and claimed are null until its mint is in the wallet */
export type CashuWalletReceiveTokenPreview = {
	amount: number;
	unit: string;
	memo: string | null;
	fee: number | null;
	claimed: boolean | null;
	mint: CashuWalletMintLookup;
};

export type CashuWalletMintProbe = {
	online: boolean;
	latency_ms: number | null;
	error: string | null;
	checked_at: number;
};

export type CashuWalletMintStatus = CashuWalletMintProbe & {
	mint_id: string;
};

export type CashuWalletMintFetch = {
	url: string;
	info: MintInfo;
	latency_ms: number;
	time_offset: number | null;
};

export type CashuWalletMintResolution =
	{url: string; known: CashuWalletMint} | {url: string; fetched: CashuWalletMintFetch; sibling: CashuWalletMint | null};

export type CashuWalletMintLookup = {
	url: string;
	info: string | null;
	latency_ms: number | null;
	time_offset: number | null;
	match: WalletMintMatch | null;
	mint_id: string | null;
};

export type CashuWalletMintRecord = CashuWalletMint & {
	is_orchard: boolean;
	name: string | null;
	info: string | null;
};

export type OrchardMintIdentity = {
	pubkey: string | null;
	/** The public URLs from its /v1/info; MINT_API is never one */
	urls: string[];
	api_url: string;
};
