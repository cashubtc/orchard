/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';
/* Local Dependencies */
import {WalletOperationType, WalletOperationState} from './cashuwallet.enums.js';

/**
 * Journal of wallet operations. The exact mint request is persisted before it is sent,
 * so an interrupted operation is replayed or restored on startup instead of regenerated.
 */
@Entity('cashu_wallet_operations')
@Index(['state'])
@Index(['user_id'])
export class CashuWalletOperation {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	// User whose wallet the operation belongs to
	@Column({type: 'text'})
	user_id: string;

	// Wallet mint (cashu_wallet_mints.id) the operation talks to
	@Column({type: 'text'})
	mint_id: string;

	// Payment method for mint/melt operations (bolt11, bolt12, onchain or a custom name); null for swaps
	@Column({type: 'text', nullable: true})
	method: string | null;

	@Column({type: 'text'})
	type: WalletOperationType;

	@Column({type: 'text'})
	state: WalletOperationState;

	// Incremented on every state change; updates are conditional on it
	@Column({type: 'integer', default: 0})
	revision: number;

	@Column({type: 'text'})
	unit: string;

	// Operation amount in the smallest unit
	@Column({type: 'integer'})
	amount: number;

	// Mint quote id, for operations backed by a quote
	@Column({type: 'text', nullable: true})
	quote_id: string | null;

	// NUT-20 seed counter of the key locking the quote; null for unlocked quotes
	@Column({type: 'integer', nullable: true})
	quote_counter: number | null;

	// Operator note shown in wallet history
	@Column({type: 'text', nullable: true})
	memo: string | null;

	// Serialized output data (secrets, blinding factors, blinded messages) sent to the mint
	@Column({type: 'text', nullable: true})
	outputs: string | null;

	// Secrets of the input proofs spent by this operation (JSON array)
	@Column({type: 'text', nullable: true})
	inputs: string | null;

	// Last failure reason, for operator diagnosis
	@Column({type: 'text', nullable: true})
	error: string | null;

	// Creation timestamp (unix)
	@Column({type: 'integer'})
	created_at: number;

	// Last state change timestamp (unix)
	@Column({type: 'integer'})
	updated_at: number;
}
