/* Vendor Dependencies */
import {v4 as uuidv4} from 'uuid';
/* Shared Dependencies */
import {OrchardMintSwap, MintUnit} from '@shared/generated.types';

export class MintSwap implements OrchardMintSwap {
	public id: string;
	public operation_id: string | null;
	public keyset_ids: string[];
	public unit: MintUnit;
	public amount: number;
	public created_time: number;
	public fee: number | null;

	constructor(swap: OrchardMintSwap) {
		this.id = uuidv4();
		this.operation_id = swap.operation_id ?? null;
		this.keyset_ids = swap.keyset_ids;
		this.unit = swap.unit;
		this.amount = swap.amount;
		this.created_time = swap.created_time;
		this.fee = swap.fee ?? null;
	}
}
