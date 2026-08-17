/* Native Dependencies */
import {MintUnit, MintProofState} from '#server/modules/cashu/cashu.enums';

export type CdkMintProof = {
	created_time: number;
	keyset_id: string;
	unit: MintUnit;
	state: MintProofState;
	amounts: string;
};

export type CdkMintPromise = {
	created_time: number;
	keyset_id: string;
	unit: MintUnit;
	amounts: string;
};
