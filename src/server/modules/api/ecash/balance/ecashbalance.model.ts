/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import type {CashuWalletBalance} from '#server/modules/cashu/wallet/cashuwallet.types';

@ObjectType({description: 'Ecash wallet balance for a unit and keyset'})
export class OrchardEcashBalance {
	@Field({description: 'Unit of the balance'})
	unit: string;

	@Field({description: 'Keyset identifier'})
	keyset_id: string;

	@Field(() => Int, {description: 'Balance amount in the smallest unit'})
	balance: number;

	constructor(cashu_wallet_balance: CashuWalletBalance) {
		this.unit = cashu_wallet_balance.unit;
		this.keyset_id = cashu_wallet_balance.keyset_id;
		this.balance = cashu_wallet_balance.balance;
	}
}
