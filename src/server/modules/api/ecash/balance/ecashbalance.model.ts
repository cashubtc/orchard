/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import type {CashuWalletBalance} from '#server/modules/cashu/wallet/cashuwallet.types';

@ObjectType({description: 'Ecash wallet balance for a mint and unit'})
export class OrchardEcashBalance {
	@Field({description: 'Wallet mint identifier'})
	mint_id: string;

	@Field({description: 'Unit of the balance'})
	unit: string;

	@Field(() => Int, {description: 'Balance amount in the smallest unit'})
	balance: number;

	constructor(cashu_wallet_balance: CashuWalletBalance) {
		this.mint_id = cashu_wallet_balance.mint_id;
		this.unit = cashu_wallet_balance.unit;
		this.balance = cashu_wallet_balance.balance;
	}
}
