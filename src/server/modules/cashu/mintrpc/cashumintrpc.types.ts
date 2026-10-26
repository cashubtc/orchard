/* Application Dependencies */
import type {CdkRpcMethods} from '#server/modules/cashu/cdk/cdkrpc.types';

export type CashuMintInfoRpc = CdkRpcMethods['GetInfo']['response'] & {
	description_long?: string;
	total_issued?: string;
	total_redeemed?: string;
};
