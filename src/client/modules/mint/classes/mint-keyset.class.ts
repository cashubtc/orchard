import {MintUnit, OrchardMintKeyset} from '@shared/generated.types';

export class MintKeyset implements OrchardMintKeyset {
	id: string;
	active: boolean;
	derivation_path: string;
	derivation_path_index: number;
	input_fee_ppk: number;
	seed_encryption_method?: string | null;
	unit: MintUnit;
	valid_from: number | null;
	valid_to: number | null;
	final_expiry: number | null;
	fees_paid: number;
	amounts: number[] | null;

	constructor(omk: OrchardMintKeyset) {
		this.id = omk.id;
		this.active = omk.active;
		this.derivation_path = omk.derivation_path;
		this.derivation_path_index = omk.derivation_path_index;
		this.input_fee_ppk = omk.input_fee_ppk ? omk.input_fee_ppk : 0;
		this.unit = omk.unit as MintUnit;
		this.valid_from = omk.valid_from ?? null;
		this.valid_to = omk.valid_to ?? null;
		this.final_expiry = omk.final_expiry ?? null;
		this.fees_paid = omk.fees_paid;
		this.amounts = omk.amounts ?? null;
	}
}
