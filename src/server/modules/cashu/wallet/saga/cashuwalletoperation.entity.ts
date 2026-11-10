/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';
/* Local Dependencies */
import {WalletOperationType, WalletOperationState} from '../cashuwallet.enums.js';

/**
 * Journal of wallet operations. The exact mint request is persisted before it is sent,
 * so an interrupted operation is replayed or restored on startup instead of regenerated.
 */
@Entity('cashu_wallet_operations')
@Index(['state'])
@Index(['user_id', 'created_at'])
@Index(['mint_id', 'quote_id'])
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

	// Payment request the operation receives on or pays: an invoice, offer or address
	@Column({type: 'text', nullable: true})
	request: string | null;

	// When the quote or request expires (unix)
	@Column({type: 'integer', nullable: true})
	expiry: number | null;

	// Fee actually paid, in the smallest unit
	@Column({type: 'integer', nullable: true})
	fee: number | null;

	// Most a melt's fee could be, in the smallest unit
	@Column({type: 'integer', nullable: true})
	fee_reserve: number | null;

	// Onchain melt speed chosen from the quote's fee options
	@Column({type: 'integer', nullable: true})
	fee_index: number | null;

	// Request prepared by cashu-ts and persisted before the mint call (serialized outputs, swap preview or melt change)
	@Column({type: 'text', nullable: true})
	preview: string | null;

	// NUT-13 counter ranges the prepared outputs used (JSON), for restore
	@Column({type: 'text', nullable: true})
	counters: string | null;

	// Input proofs spent by this operation (serialized), for replay
	@Column({type: 'text', nullable: true})
	inputs: string | null;

	// Encoded token of an ecash send
	@Column({type: 'text', nullable: true})
	token: string | null;

	// Lightning preimage or onchain outpoint (txid:vout) once paid
	@Column({type: 'text', nullable: true})
	payment_proof: string | null;

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
