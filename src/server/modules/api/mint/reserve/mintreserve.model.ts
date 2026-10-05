/* Core Dependencies */
import {Field, Float, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {MintReserveSource, MintReserveStatus} from '#server/modules/cashu/cashu.enums';
import type {OrchardErrorCode} from '#server/modules/error/error.types';

@ObjectType({description: 'Mint liabilities in one bitcoin unit'})
export class OrchardMintReserveLiability {
	@Field({description: 'Unit the liabilities are denominated in'})
	unit: string;

	@Field(() => Float, {description: 'Unspent ecash in the smallest unit'})
	amount: number;

	constructor(unit: string, amount: number) {
		this.unit = unit;
		this.amount = amount;
	}
}

@ObjectType({description: 'A balance that can back mint liabilities'})
export class OrchardMintReserveSource {
	@Field(() => MintReserveSource, {description: 'Which balance this is'})
	source: MintReserveSource;

	@Field(() => MintReserveStatus, {description: 'Whether the balance could be read'})
	status: MintReserveStatus;

	@Field(() => Float, {nullable: true, description: 'Balance in sats, when available'})
	amount: number | null;

	@Field(() => Int, {nullable: true, description: 'Orchard error code, when the balance could not be read'})
	error_code: OrchardErrorCode | null;

	@Field(() => String, {nullable: true, description: "The backend's own error message, when the balance could not be read"})
	error_details: string | null;

	@Field({description: 'Whether the operator counts this balance as reserves'})
	selected: boolean;

	constructor(
		source: MintReserveSource,
		reading: Pick<OrchardMintReserveSource, 'status' | 'error_code' | 'error_details'>,
		amount: number | null,
		selected: boolean,
	) {
		this.source = source;
		this.status = reading.status;
		this.amount = amount;
		this.error_code = reading.error_code;
		this.error_details = reading.error_details;
		this.selected = selected;
	}
}

@ObjectType({description: 'Bitcoin liabilities of the mint and every balance that can back them'})
export class OrchardMintReserves {
	@Field(() => [OrchardMintReserveLiability], {description: 'Liabilities per bitcoin unit'})
	liabilities: OrchardMintReserveLiability[];

	@Field(() => [OrchardMintReserveSource], {description: 'Every reserve source, whether or not it could be read'})
	sources: OrchardMintReserveSource[];

	@Field(() => Float, {nullable: true, description: 'Sats held in the selected sources that could be read; null when none could'})
	reserves: number | null;

	@Field({description: 'Whether a selected source could not be read, leaving the reserves short'})
	partial: boolean;

	constructor(liabilities: OrchardMintReserveLiability[], sources: OrchardMintReserveSource[]) {
		const selected_sources = sources.filter((source) => source.selected);
		const readable_sources = selected_sources.filter((source) => source.status === MintReserveStatus.AVAILABLE);
		this.liabilities = liabilities;
		this.sources = sources;
		this.reserves = readable_sources.length > 0 ? readable_sources.reduce((sum, source) => sum + (source.amount ?? 0), 0) : null;
		this.partial = selected_sources.some((source) => source.status === MintReserveStatus.UNAVAILABLE);
	}
}
