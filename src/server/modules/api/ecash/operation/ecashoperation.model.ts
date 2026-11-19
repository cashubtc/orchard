/* Core Dependencies */
import {Field, Float, ID, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {WalletOperationType, WalletOperationState} from '#server/modules/cashu/wallet/cashuwallet.enums';
import type {CashuWalletOperationUpdate} from '#server/modules/cashu/wallet/cashuwallet.types';

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

	@Field(() => Float, {description: 'Amount in the smallest unit'})
	amount: number;

	@Field(() => Float, {nullable: true, description: 'Fee paid in the smallest unit, when one applies'})
	fee: number | null;

	@Field(() => Float, {nullable: true, description: "Most a melt's fee could be, in the smallest unit"})
	fee_reserve: number | null;

	@Field(() => String, {nullable: true, description: 'Invoice, offer or address the operation pays or receives on'})
	request: string | null;

	@Field(() => UnixTimestamp, {nullable: true, description: "When the operation's quote expires"})
	expiry: number | null;

	@Field(() => String, {nullable: true, description: 'Lightning preimage or onchain outpoint (txid:vout) once paid'})
	payment_proof: string | null;

	@Field(() => String, {nullable: true, description: 'Operator note'})
	memo: string | null;

	@Field(() => String, {nullable: true, description: 'Last failure reason'})
	error: string | null;

	@Field(() => UnixTimestamp, {description: 'When the operation was created'})
	created_at: number;

	@Field(() => UnixTimestamp, {description: 'When the operation last changed state'})
	updated_at: number;

	constructor(operation: CashuWalletOperationUpdate) {
		this.id = operation.id;
		this.mint_id = operation.mint_id;
		this.type = operation.type;
		this.state = operation.state;
		this.method = operation.method;
		this.unit = operation.unit;
		this.amount = operation.amount;
		this.fee = operation.fee;
		this.fee_reserve = operation.fee_reserve;
		this.request = operation.request;
		this.expiry = operation.expiry;
		this.payment_proof = operation.payment_proof;
		this.memo = operation.memo;
		this.error = operation.error;
		this.created_at = operation.created_at;
		this.updated_at = operation.updated_at;
	}
}
