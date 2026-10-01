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

	constructor(
		source: MintReserveSource,
		reading: Pick<OrchardMintReserveSource, 'status' | 'error_code' | 'error_details'>,
		amount: number | null,
	) {
		this.source = source;
		this.status = reading.status;
		this.amount = amount;
		this.error_code = reading.error_code;
		this.error_details = reading.error_details;
	}
}

@ObjectType({description: 'Bitcoin liabilities of the mint and every balance that can back them'})
export class OrchardMintReserves {
	@Field(() => [OrchardMintReserveLiability], {description: 'Liabilities per bitcoin unit'})
	liabilities: OrchardMintReserveLiability[];

	@Field(() => [OrchardMintReserveSource], {description: 'Every reserve source, whether or not it could be read'})
	sources: OrchardMintReserveSource[];

	constructor(liabilities: OrchardMintReserveLiability[], sources: OrchardMintReserveSource[]) {
		this.liabilities = liabilities;
		this.sources = sources;
	}
}
