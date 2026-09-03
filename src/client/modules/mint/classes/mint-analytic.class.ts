import {OrchardMintAnalytics, OrchardMintKeysetsAnalytics} from '@shared/generated.types';

export class MintAnalytic implements OrchardMintAnalytics {
	unit: string;
	amount: string;
	date: number;
	count?: number | null;

	constructor(oma: OrchardMintAnalytics) {
		this.unit = oma.unit;
		this.amount = oma.amount;
		this.date = oma.date;
		this.count = oma.count;
	}
}

export class MintAnalyticKeyset implements OrchardMintKeysetsAnalytics {
	keyset_id: string;
	amount: string;
	date: number;

	constructor(oma: OrchardMintKeysetsAnalytics) {
		this.keyset_id = oma.keyset_id;
		this.amount = oma.amount;
		this.date = oma.date;
	}
}
