/* Core Dependencies */
import {Field, ID, ObjectType} from '@nestjs/graphql';
/* Vendor Dependencies */
import {JSONInt, MintInfo, type GetInfoResponse} from '@cashu/cashu-ts';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import type {CashuWalletMintRecord} from '#server/modules/cashu/wallet/cashuwallet.types';

@ObjectType({description: "A mint in the current user's ecash wallet"})
export class OrchardEcashMint {
	@Field(() => ID, {description: 'Wallet mint identifier'})
	id: string;

	@Field(() => String, {nullable: true, description: 'Mint name from its info'})
	name: string | null;

	@Field(() => [String], {description: 'Normalized mint URLs; the first is used in tokens'})
	urls: string[];

	@Field(() => String, {nullable: true, description: 'Mint pubkey from its info'})
	pubkey: string | null;

	@Field(() => String, {nullable: true, description: 'Mint icon URL from its info'})
	icon_url: string | null;

	@Field(() => [String], {description: 'Units the mint issues'})
	units: string[];

	@Field({description: 'Whether this is the mint Orchard manages'})
	is_orchard: boolean;

	@Field(() => UnixTimestamp, {description: 'When the mint was added to the wallet'})
	created_at: number;

	constructor(mint: CashuWalletMintRecord) {
		const info = mint.info ? new MintInfo(JSONInt.parse(mint.info) as GetInfoResponse) : null;
		this.id = mint.id;
		this.name = mint.name;
		this.urls = mint.urls;
		this.pubkey = mint.pubkey;
		this.icon_url = info?.icon_url || null;
		this.units = [...new Set((info?.isSupported(4).params ?? []).map((method) => method.unit))];
		this.is_orchard = mint.is_orchard;
		this.created_at = mint.created_at;
	}
}
