/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';

/**
 * Reusable mint quotes a wallet receives on: BOLT 12 offers and onchain addresses.
 * Each payment to one becomes its own mint operation for what was paid since the last.
 */
@Entity('cashu_wallet_quotes')
@Index(['user_id', 'mint_id', 'method'])
@Index(['mint_id', 'quote_id'], {unique: true})
export class CashuWalletQuote {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	// User whose wallet the quote belongs to
	@Column({type: 'text'})
	user_id: string;

	// Wallet mint (cashu_wallet_mints.id) that issued the quote
	@Column({type: 'text'})
	mint_id: string;

	// Payment method: bolt12 or onchain
	@Column({type: 'text'})
	method: string;

	@Column({type: 'text'})
	unit: string;

	// Mint quote id
	@Column({type: 'text'})
	quote_id: string;

	// NUT-20 seed counter of the key locking the quote
	@Column({type: 'integer'})
	quote_counter: number;

	// What payers pay to: the offer or address
	@Column({type: 'text'})
	request: string;

	// Fixed amount every payment must be; null when payers choose
	@Column({type: 'integer', nullable: true})
	amount: number | null;

	@Column({type: 'text', nullable: true})
	description: string | null;

	// When the mint stops crediting payments (unix); null when it never does
	@Column({type: 'integer', nullable: true})
	expiry: number | null;

	// Total the mint has seen paid, in the smallest unit
	@Column({type: 'integer', default: 0})
	amount_paid: number;

	// Total the mint has issued against it, in the smallest unit
	@Column({type: 'integer', default: 0})
	amount_issued: number;

	// When a new payment was last seen (unix)
	@Column({type: 'integer', nullable: true})
	last_paid_at: number | null;

	// Whether this is the quote shown for its mint and method
	@Column({type: 'boolean', default: true})
	latest: boolean;

	// Last block scanned for deposits to an onchain address
	@Column({type: 'integer', nullable: true})
	chain_height: number | null;

	// Deposits seen onchain before the mint credits them (JSON)
	@Column({type: 'text', nullable: true})
	deposits: string | null;

	// Creation timestamp (unix)
	@Column({type: 'integer'})
	created_at: number;

	// Last change timestamp (unix)
	@Column({type: 'integer'})
	updated_at: number;
}
