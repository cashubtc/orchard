/* Core Dependencies */
import {Field, Int, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import type {BitcoinFeeEstimate} from '#server/modules/bitcoin/rpc/btcrpc.types';

@ObjectType({description: 'Bitcoin transaction fee estimate for a confirmation target'})
export class OrchardBitcoinTxFeeEstimate {
	@Field(() => Int, {description: 'Confirmation target in number of blocks'})
	target: number;

	@Field(() => Float, {nullable: true, description: 'Estimated fee rate in BTC/kB'})
	feerate: number;

	@Field(() => [String], {nullable: true, description: 'Errors encountered during estimation'})
	errors: string[];

	@Field(() => Int, {description: 'Number of blocks for which the estimate is valid'})
	blocks: number;

	constructor(target: number, obte: BitcoinFeeEstimate) {
		this.target = target;
		this.feerate = obte.feerate;
		this.errors = obte.errors;
		this.blocks = obte.blocks;
	}
}
