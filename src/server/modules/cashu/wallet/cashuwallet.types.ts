/* Vendor Dependencies */
import type {MintInfo} from '@cashu/cashu-ts';
/* Local Dependencies */
import type {CashuWalletMint} from './cashuwalletmint.entity.js';

export type CashuWalletBalance = {
	mint_id: string;
	unit: string;
	balance: number;
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
