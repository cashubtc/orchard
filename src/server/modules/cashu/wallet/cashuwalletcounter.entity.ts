/* Vendor Dependencies */
import {Entity, Column, PrimaryColumn} from 'typeorm';

/**
 * NUT-13 deterministic counter cursor per user seed and keyset: the next unused counter.
 */
@Entity('cashu_wallet_counters')
export class CashuWalletCounter {
	@PrimaryColumn({type: 'text'})
	user_id: string;

	@PrimaryColumn({type: 'text'})
	keyset_id: string;

	@Column({type: 'integer', default: 0})
	next: number;

	// Last reservation timestamp (unix)
	@Column({type: 'integer'})
	updated_at: number;
}
