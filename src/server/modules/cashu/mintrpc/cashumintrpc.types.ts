import type {CashuMintInfo} from '#server/modules/cashu/mintapi/cashumintapi.types';

export type CashuMintInfoRpc = Omit<CashuMintInfo, 'nuts'> & {
	total_issued: string;
	total_redeemed: string;
};

/** cdk WalletService GetBalance; uint64 amounts arrive as strings */
export type CashuMintWalletBalanceRpc = {
	confirmed_sat: string;
	trusted_pending_sat: string;
	untrusted_pending_sat: string;
	immature_sat: string;
	trusted_spendable_sat: string;
	total_sat: string;
	network: string;
	synced_height: number;
};
