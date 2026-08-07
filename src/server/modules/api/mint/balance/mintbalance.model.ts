/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {CashuMintBalance} from '#server/modules/cashu/mintdb/cashumintdb.types';

@ObjectType({description: 'Cashu mint keyset balance'})
export class OrchardMintBalance {
	@Field({description: 'Keyset identifier'})
	keyset: string;

	@Field(() => Int, {description: 'Balance amount in the smallest unit'})
	balance: number;

	constructor(cashu_mint_balance: CashuMintBalance) {
		this.keyset = cashu_mint_balance.keyset;
		this.balance = cashu_mint_balance.balance;
	}
}
