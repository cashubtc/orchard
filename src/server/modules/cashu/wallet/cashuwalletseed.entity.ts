/* Vendor Dependencies */
import {Entity, Column, PrimaryColumn} from 'typeorm';

/**
 * A user's ecash wallet NUT-13 seed. Keyed by user, so each user has at most one.
 */
@Entity('cashu_wallet_seed')
export class CashuWalletSeed {
	@PrimaryColumn({type: 'text'})
	user_id: string;

	// BIP-39 mnemonic, encrypted with the crypto key
	@Column({type: 'text'})
	mnemonic: string;

	// Creation timestamp (unix)
	@Column({type: 'integer'})
	created_at: number;
}
