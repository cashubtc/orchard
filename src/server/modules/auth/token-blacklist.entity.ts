/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';

@Entity('token_blacklist')
export class TokenBlacklist {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({type: 'varchar', unique: true, length: 64})
	@Index()
	token_hash: string; // SHA-256 hash of the token for privacy and efficiency

	@Column({type: 'varchar'})
	user_id: string; // user who owned the token

	@Column({type: 'integer'})
	@Index()
	expires_at: number; // JWT expiration timestamp (for cleanup)

	@Column({type: 'integer'})
	revoked_at: number; // when token was revoked
}
