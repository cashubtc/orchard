/* Vendor Dependencies */
import {Entity, Column, PrimaryColumn, Index} from 'typeorm';
/* Local Dependencies */
import {WalletProofState} from '../cashuwallet.enums.js';

/**
 * Ecash proofs held by users' wallets.
 */
@Entity('cashu_wallet_proofs')
@Index(['user_id', 'mint_id', 'unit', 'state'])
@Index(['used_by_op_id'])
export class CashuWalletProof {
	// Proof secret, unique per proof
	@PrimaryColumn({type: 'text'})
	secret: string;

	// Owner of the proof
	@Column({type: 'text'})
	user_id: string;

	// Wallet mint (cashu_wallet_mints.id) that issued the proof
	@Column({type: 'text'})
	mint_id: string;

	// Keyset id the proof was signed with
	@Column({type: 'text'})
	keyset_id: string;

	// Unit of the keyset (sat, usd, ...)
	@Column({type: 'text'})
	unit: string;

	// Amount in the smallest unit
	@Column({type: 'integer'})
	amount: number;

	// Unblinded mint signature
	@Column({type: 'text'})
	c: string;

	// Serialized NUT-12 DLEQ proof (JSON), null when the mint sent none
	@Column({type: 'text', nullable: true})
	dleq: string | null;

	@Column({type: 'text', default: WalletProofState.READY})
	state: WalletProofState;

	// Operation that produced this proof
	@Column({type: 'text', nullable: true})
	created_by_op_id: string | null;

	// Operation currently holding this proof as an input; null when free
	@Column({type: 'text', nullable: true})
	used_by_op_id: string | null;

	// Creation timestamp (unix)
	@Column({type: 'integer'})
	created_at: number;

	// Last state change timestamp (unix)
	@Column({type: 'integer'})
	updated_at: number;
}
