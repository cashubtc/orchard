/* Vendor Dependencies */
import type {MintInfo} from '@cashu/cashu-ts';
/* Local Dependencies */
import type {CashuWalletMint} from './cashuwalletmint.entity.js';
import type {CashuWalletSeed} from './cashuwalletseed.entity.js';

export type CashuWalletBalance = {
	mint_id: string;
	unit: string;
	balance: number;
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
