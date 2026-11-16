/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';

/**
 * Mint quotes a wallet receives on: BOLT 11 invoices, BOLT 12 offers and onchain addresses.
 * Nothing reaches the wallet's operations until one is paid; each payment then becomes its own mint operation.
 */
@Entity('cashu_wallet_quotes')
@Index(['user_id', 'mint_id', 'method', 'unit'])
@Index(['user_id', 'mint_id', 'method', 'unit'], {unique: true, where: '"latest" = 1'})
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

	// Payment method: bolt11, bolt12 or onchain
	@Column({type: 'text'})
	method: string;

	@Column({type: 'text'})
	unit: string;

	// Mint quote id
	@Column({type: 'text'})
	quote_id: string;

	// NUT-20 seed counter of the key locking the quote; null for a bolt11 quote from a mint without NUT-20
	@Column({type: 'integer', nullable: true})
	quote_counter: number | null;

	// What payers pay to: the invoice, offer or address
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

	// Whether this is the offer or address shown for its mint, method and unit
	@Column({type: 'boolean', default: false})
	latest: boolean;

	// Until when it's checked for payments (unix)
	@Column({type: 'integer'})
	check_until: number;

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
