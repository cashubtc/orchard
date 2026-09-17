/* Native Dependencies */
import {MintProofState} from '#server/modules/cashu/cashu.enums';

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
