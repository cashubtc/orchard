import {OrchardEcashBalance} from '@shared/generated.types';

export class EcashBalance implements OrchardEcashBalance {
	mint_id: string;
	unit: string;
	balance: number;

	constructor(oeb: OrchardEcashBalance) {
		this.mint_id = oeb.mint_id;
		this.unit = oeb.unit;
		this.balance = oeb.balance;
	}
}
