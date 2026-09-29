/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';

/**
 * Mints a user's wallet trusts. The Orchard mint is added automatically when one is configured.
 */
@Entity('cashu_wallet_mints')
@Index(['user_id', 'pubkey'], {unique: true, where: 'pubkey IS NOT NULL'})
@Index(['user_id'])
export class CashuWalletMint {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({type: 'text'})
	user_id: string;

	// NUT-06 mint pubkey; stable across URLs, null when the mint doesn't publish one
	@Column({type: 'text', nullable: true})
	pubkey: string | null;

	// Normalized public URLs; the first is written into tokens this wallet creates
	@Column({type: 'simple-json'})
	urls: string[];

	// Mint name from /v1/info, null until first lookup succeeds
	@Column({type: 'text', nullable: true})
	name: string | null;

	// Cached /v1/info response (JSON)
	@Column({type: 'text', nullable: true})
	info: string | null;

	// Last successful /v1/info lookup (unix)
	@Column({type: 'integer', nullable: true})
	info_updated_at: number | null;

	// Creation timestamp (unix)
	@Column({type: 'integer'})
	created_at: number;
}
