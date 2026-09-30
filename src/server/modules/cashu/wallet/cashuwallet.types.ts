/* Vendor Dependencies */
import type {MintInfo, MintQuoteBaseResponse, MintQuoteState} from '@cashu/cashu-ts';
/* Local Dependencies */
import type {CashuWalletMint} from './cashuwalletmint.entity.js';
import type {CashuWalletSeed} from './cashuwalletseed.entity.js';
import type {WalletOperationState, WalletOperationType} from './cashuwallet.enums.js';

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

export type CashuWalletMintRecord = CashuWalletMint & {
	is_orchard: boolean;
};

export type OrchardMintIdentity = {
	pubkey: string | null;
	urls: string[];
	api_url: string;
	info: MintInfo;
};
