/* Vendor Dependencies */
import {Entity, Column, PrimaryColumn} from 'typeorm';

/**
 * Shared /v1/info cache, keyed by the exact URL it was fetched from so one user's mint URL can't feed another's.
 */
@Entity('cashu_wallet_mint_infos')
export class CashuWalletMintInfo {
	// Normalized URL the info was fetched from (MINT_API for the Orchard mint)
	@PrimaryColumn({type: 'text'})
	mint_url: string;

	// NUT-06 pubkey the URL reported
	@Column({type: 'text', nullable: true})
	pubkey: string | null;

	@Column({type: 'text', nullable: true})
	name: string | null;

	// /v1/info response (JSON)
	@Column({type: 'text'})
	info: string;

	// Last successful /v1/info fetch (unix)
	@Column({type: 'integer'})
	info_updated_at: number;

	// Last successful /v1/keysets fetch (unix); null before keysets were cached
	@Column({type: 'integer', nullable: true})
	keysets_updated_at: number | null;
}
