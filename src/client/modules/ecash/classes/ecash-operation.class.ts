import {OrchardEcashOperation, WalletOperationState, WalletOperationType} from '@shared/generated.types';

export class EcashOperation implements OrchardEcashOperation {
	id: string;
	mint_id: string;
	type: WalletOperationType;
	state: WalletOperationState;
	method: string | null;
	unit: string;
	amount: number;
	memo: string | null;
	error: string | null;
	created_at: number;
	updated_at: number;

	constructor(oeo: OrchardEcashOperation) {
		this.id = oeo.id;
		this.mint_id = oeo.mint_id;
		this.type = oeo.type;
		this.state = oeo.state;
		this.method = oeo.method ?? null;
		this.unit = oeo.unit;
		this.amount = oeo.amount;
		this.memo = oeo.memo ?? null;
		this.error = oeo.error ?? null;
		this.created_at = oeo.created_at;
		this.updated_at = oeo.updated_at;
	}
}
