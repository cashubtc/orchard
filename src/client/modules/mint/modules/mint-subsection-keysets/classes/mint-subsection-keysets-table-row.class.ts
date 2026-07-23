/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintAnalyticKeyset} from '@client/modules/mint/classes/mint-analytic.class';
import {MintKeysetCount} from '@client/modules/mint/classes/mint-keyset-count.class';

export class MintSubsectionKeysetsTableRow {
	active: boolean;
	derivation_path_index: number;
	id: string;
	input_fee_ppk: number;
	unit: string;
	valid_from: number | null;
	valid_to: number | null;
	final_expiry: number | null;
	fees_paid: number | null;
	balance: number;
	proof_count: number;
	promise_count: number;
	amounts: number[] | null;

	constructor(
		keyset: MintKeyset,
		keyset_analytics: MintAnalyticKeyset[],
		keyset_analytics_pre: MintAnalyticKeyset[],
		keyset_count: MintKeysetCount | undefined,
	) {
		this.active = keyset.active;
		this.derivation_path_index = keyset.derivation_path_index;
		this.id = keyset.id;
		this.input_fee_ppk = keyset.input_fee_ppk;
		this.unit = keyset.unit;
		this.valid_from = keyset.valid_from;
		this.valid_to = keyset.valid_to;
		this.final_expiry = keyset.final_expiry;
		this.fees_paid = keyset.fees_paid;
		this.balance = this.getBalance(keyset_analytics, keyset_analytics_pre);
		this.proof_count = keyset_count?.proof_count ?? 0;
		this.promise_count = keyset_count?.promise_count ?? 0;
		this.amounts = keyset.amounts;
	}

	private getBalance(keyset_analytics: MintAnalyticKeyset[], keyset_analytics_pre: MintAnalyticKeyset[]): number {
		const balance = keyset_analytics.reduce((acc, curr) => acc + BigInt(curr.amount), 0n);
		const balance_pre = keyset_analytics_pre.reduce((acc, curr) => acc + BigInt(curr.amount), 0n);
		return Number(balance_pre + balance);
	}
}
