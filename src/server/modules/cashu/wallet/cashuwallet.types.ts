/* Vendor Dependencies */
import type {MintInfo, MintQuoteBaseResponse, MintQuoteState} from '@cashu/cashu-ts';
/* Local Dependencies */
import type {CashuWalletMint} from './mint/cashuwalletmint.entity.js';
import type {CashuWalletSeed} from './seed/cashuwalletseed.entity.js';
import type {CashuWalletOperation} from './saga/cashuwalletoperation.entity.js';
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

export type CashuWalletMintQuote = MintQuoteBaseResponse & {
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

export type CashuWalletWatch = {
	operation: CashuWalletOperation;
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

/** A token before it's received: amount is before the fee; fee and claimed are null until its mint is in the wallet */
export type CashuWalletTokenPreview = {
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
