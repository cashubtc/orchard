/* Vendor Dependencies */
import type {ChannelCredentials} from '@grpc/grpc-js';
/* Native Dependencies */
import {MintProofState} from '#server/modules/cashu/cashu.enums';

export type CdkGrpcCredentials = {
	rpc_url: string;
	credentials: ChannelCredentials;
	channel_options: Record<string, string> | undefined;
	auth: string;
};

export type CdkMintProof = {
	created_time: number;
	keyset_id: string;
	unit: string;
	state: MintProofState;
	amounts: string;
};

export type CdkMintPromise = {
	created_time: number;
	keyset_id: string;
	unit: string;
	amounts: string;
};
