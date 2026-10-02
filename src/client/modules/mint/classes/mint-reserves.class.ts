import {
	MintReserveSource,
	MintReserveStatus,
	OrchardMintReserveLiability,
	OrchardMintReserveSource,
	OrchardMintReserves,
} from '@shared/generated.types';

export class MintReserveLiability implements OrchardMintReserveLiability {
	public unit: string;
	public amount: number;

	constructor(omrl: OrchardMintReserveLiability) {
		this.unit = omrl.unit;
		this.amount = omrl.amount;
	}
}

/** Not named MintReserveSource, which is the generated enum of sources */
export class MintReserveSourceBalance implements OrchardMintReserveSource {
	public source: MintReserveSource;
	public status: MintReserveStatus;
	public amount: number | null;
	public error_code: number | null;
	public error_details: string | null;

	constructor(omrs: OrchardMintReserveSource) {
		this.source = omrs.source;
		this.status = omrs.status;
		this.amount = omrs.amount ?? null;
		this.error_code = omrs.error_code ?? null;
		this.error_details = omrs.error_details ?? null;
	}
}

export class MintReserves implements OrchardMintReserves {
	public liabilities: MintReserveLiability[];
	public sources: MintReserveSourceBalance[];

	constructor(omr: OrchardMintReserves) {
		this.liabilities = omr.liabilities.map((liability) => new MintReserveLiability(liability));
		this.sources = omr.sources.map((source) => new MintReserveSourceBalance(source));
	}
}
