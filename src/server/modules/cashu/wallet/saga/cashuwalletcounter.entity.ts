/* Vendor Dependencies */
import {Entity, Column, PrimaryColumn} from 'typeorm';

/**
 * Seed derivation counter cursor per user and counter key: the next unused counter.
 */
@Entity('cashu_wallet_counters')
export class CashuWalletCounter {
	@PrimaryColumn({type: 'text'})
	user_id: string;

	// A keyset id for NUT-13 outputs, or `nut20` for quote locking keys
	@PrimaryColumn({type: 'text'})
	counter_key: string;

	@Column({type: 'integer', default: 0})
	next: number;

	// Last reservation timestamp (unix)
	@Column({type: 'integer'})
	updated_at: number;
}
