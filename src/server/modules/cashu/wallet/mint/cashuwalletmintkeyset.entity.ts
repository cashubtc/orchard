/* Vendor Dependencies */
import {Entity, Column, PrimaryColumn} from 'typeorm';

/**
 * Shared keyset cache per mint URL. Keys never change for a keyset id, so they are fetched once.
 */
@Entity('cashu_wallet_mint_keysets')
export class CashuWalletMintKeyset {
	// Normalized URL the keyset was fetched from
	@PrimaryColumn({type: 'text'})
	mint_url: string;

	@PrimaryColumn({type: 'text'})
	id: string;

	@Column({type: 'text'})
	unit: string;

	@Column({type: 'boolean'})
	active: boolean;

	@Column({type: 'integer', default: 0})
	input_fee_ppk: number;

	// Unix time after which the keyset is no longer valid
	@Column({type: 'integer', nullable: true})
	final_expiry: number | null;

	// Amount to public key map (JSON); null until fetched
	@Column({type: 'text', nullable: true})
	keys: string | null;

	// Last time this keyset's status was refreshed (unix)
	@Column({type: 'integer'})
	updated_at: number;
}
