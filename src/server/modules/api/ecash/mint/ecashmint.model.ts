/* Core Dependencies */
import {Field, ID, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {OrchardMintInfo} from '#server/modules/api/mint/info/mintinfo.model';
import type {CashuMintInfo} from '#server/modules/cashu/mintapi/cashumintapi.types';
import type {CashuWalletMintRecord, CashuWalletMintStatus} from '#server/modules/cashu/wallet/cashuwallet.types';

@ObjectType({description: "A mint in the current user's ecash wallet"})
export class OrchardEcashMint {
	@Field(() => ID, {description: 'Wallet mint identifier'})
	id: string;

	@Field(() => [String], {description: 'Normalized mint URLs; the first is used in tokens'})
	urls: string[];

	@Field({description: 'Whether this is the mint Orchard manages'})
	is_orchard: boolean;

	@Field(() => UnixTimestamp, {description: 'When the mint was added to the wallet'})
	created_at: number;

	@Field(() => OrchardMintInfo, {
		nullable: true,
		description: "The mint's own info, so the wallet knows what it supports; null until first fetched",
	})
	info: OrchardMintInfo | null;

	constructor(mint: CashuWalletMintRecord) {
		this.id = mint.id;
		this.urls = mint.urls;
		this.is_orchard = mint.is_orchard;
		this.created_at = mint.created_at;
		// Plain parse: GraphQL Float can't carry the bigints JSONInt makes of out-of-range amounts
		this.info = mint.info ? new OrchardMintInfo(JSON.parse(mint.info) as CashuMintInfo) : null;
	}
}

@ObjectType({description: "Reachability of a mint in the current user's ecash wallet"})
export class OrchardEcashMintStatus {
	@Field(() => ID, {description: 'Wallet mint identifier'})
	mint_id: string;

	@Field({description: 'Whether the mint answered its info request'})
	online: boolean;

	@Field(() => Int, {nullable: true, description: 'Round trip time of the info request in milliseconds, when online'})
	latency_ms: number | null;

	@Field(() => String, {nullable: true, description: 'Why the mint could not be reached'})
	error: string | null;

	@Field(() => UnixTimestamp, {description: 'When the mint was checked'})
	checked_at: number;

	constructor(status: CashuWalletMintStatus) {
		this.mint_id = status.mint_id;
		this.online = status.online;
		this.latency_ms = status.latency_ms;
		this.error = status.error;
		this.checked_at = status.checked_at;
	}
}
