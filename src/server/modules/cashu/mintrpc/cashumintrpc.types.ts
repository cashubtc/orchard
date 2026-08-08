import type {CashuMintInfo} from '#server/modules/cashu/mintapi/cashumintapi.types';

export type CashuMintInfoRpc = Omit<CashuMintInfo, 'nuts'> & {
	total_issued: string;
	total_redeemed: string;
};
