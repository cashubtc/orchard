/* Application Dependencies */
import {OrchardError} from '@client/modules/error/types/error.types';
/* Native Dependencies */
import {CHANNEL_RESERVE_SOURCES} from '@client/modules/mint/constants/mint.constants';
/* Shared Dependencies */
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
	public selected: boolean;

	/** The backend's own error, when this source could not be read */
	public get error(): OrchardError | null {
		if (this.status !== MintReserveStatus.Unavailable || this.error_code === null) return null;
		return {code: this.error_code, message: this.error_details ?? '', details: this.error_details ?? undefined};
	}

	constructor(omrs: OrchardMintReserveSource) {
		this.source = omrs.source;
		this.status = omrs.status;
		this.amount = omrs.amount ?? null;
		this.error_code = omrs.error_code ?? null;
		this.error_details = omrs.error_details ?? null;
		this.selected = omrs.selected;
	}
}

export class MintReserves implements OrchardMintReserves {
	public liabilities: MintReserveLiability[];
	public sources: MintReserveSourceBalance[];
	public reserves: number | null;
	public partial: boolean;

	/** The sources the operator counts as reserves */
	public get selected_sources(): MintReserveSource[] {
		return this.sources.filter((source) => source.selected).map((source) => source.source);
	}

	/** Errors from selected sources that could not be read, once each; both channel sources share one read */
	public get failures(): OrchardError[] {
		const errors = new Map<number, OrchardError>();
		for (const source of this.sources) {
			if (source.selected && source.error) errors.set(source.error.code, source.error);
		}
		return [...errors.values()];
	}

	/** Whether only lightning channels back the mint */
	public get channels_only(): boolean {
		return this.selected_sources.every((source) => CHANNEL_RESERVE_SOURCES.includes(source));
	}

	/** Whether a selected channel source is missing because lightning isn't set up */
	public get lightning_unconfigured(): boolean {
		return this.sources.some((source) => {
			const is_channel = CHANNEL_RESERVE_SOURCES.includes(source.source);
			return source.selected && is_channel && source.status === MintReserveStatus.Unconfigured;
		});
	}

	constructor(omr: OrchardMintReserves) {
		this.liabilities = omr.liabilities.map((liability) => new MintReserveLiability(liability));
		this.sources = omr.sources.map((source) => new MintReserveSourceBalance(source));
		this.reserves = omr.reserves ?? null;
		this.partial = omr.partial;
	}
}
