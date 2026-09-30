/* Core Dependencies */
import {Field, ID, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {WalletOperationType, WalletOperationState} from '#server/modules/cashu/wallet/cashuwallet.enums';
import type {CashuWalletOperation} from '#server/modules/cashu/wallet/cashuwalletoperation.entity';

@ObjectType({description: "An operation in the current user's ecash wallet"})
export class OrchardEcashOperation {
	@Field(() => ID, {description: 'Operation identifier'})
	id: string;

	@Field({description: 'Wallet mint identifier'})
	mint_id: string;

	@Field(() => WalletOperationType, {description: 'Operation type'})
	type: WalletOperationType;

	@Field(() => WalletOperationState, {description: 'Operation state'})
	state: WalletOperationState;

	@Field(() => String, {nullable: true, description: 'Payment method (bolt11, bolt12, onchain or custom); null for swaps'})
	method: string | null;

	@Field({description: 'Unit of the amount'})
	unit: string;

	@Field(() => Int, {description: 'Amount in the smallest unit'})
	amount: number;

	@Field(() => String, {nullable: true, description: 'Operator note'})
	memo: string | null;

	@Field(() => String, {nullable: true, description: 'Last failure reason'})
	error: string | null;

	@Field(() => UnixTimestamp, {description: 'When the operation was created'})
	created_at: number;

	@Field(() => UnixTimestamp, {description: 'When the operation last changed state'})
	updated_at: number;

	constructor(operation: CashuWalletOperation) {
		this.id = operation.id;
		this.mint_id = operation.mint_id;
		this.type = operation.type;
		this.state = operation.state;
		this.method = operation.method;
		this.unit = operation.unit;
		this.amount = operation.amount;
		this.memo = operation.memo;
		this.error = operation.error;
		this.created_at = operation.created_at;
		this.updated_at = operation.updated_at;
	}
}
