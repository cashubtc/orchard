/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {CashuMintSwap} from '#server/modules/cashu/mintdb/cashumintdb.types';
import {MintUnit} from '#server/modules/cashu/cashu.enums';

@ObjectType({description: 'Cashu mint swap record'})
export class OrchardMintSwap {
	@Field(() => String, {nullable: true, description: 'Unique operation identifier'})
	operation_id: string;

	@Field(() => [String], {description: 'Associated keyset IDs'})
	keyset_ids: string[];

	@Field(() => MintUnit, {description: 'Currency unit of the swap'})
	unit: MintUnit;

	@Field(() => Int, {description: 'Swap amount in base unit'})
	amount: number;

	@Field(() => UnixTimestamp, {description: 'Timestamp when the swap was created'})
	created_time: number;

	@Field(() => Int, {nullable: true, description: 'Fee charged for the swap'})
	fee: number | null;

	constructor(swap: CashuMintSwap) {
		this.operation_id = swap.operation_id;
		this.keyset_ids = swap.keyset_ids;
		this.unit = swap.unit;
		this.amount = swap.amount;
		this.created_time = swap.created_time;
		this.fee = swap.fee;
	}
}
