/* Core Dependencies */
import {Field, ID, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {OrchardMintInfo} from '#server/modules/api/mint/info/mintinfo.model';
import {WalletMintMatch} from '#server/modules/cashu/wallet/cashuwallet.enums';
import type {CashuMintInfo} from '#server/modules/cashu/mintapi/cashumintapi.types';
import type {CashuWalletMintLookup, CashuWalletMintRecord, CashuWalletMintStatus} from '#server/modules/cashu/wallet/cashuwallet.types';

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

@ObjectType({description: "A mint looked up before adding it to the current user's ecash wallet"})
export class OrchardEcashMintLookup {
	@Field({description: 'Normalized mint URL'})
	url: string;

	@Field(() => OrchardMintInfo, {nullable: true, description: "The mint's own info; null when the URL is already in the wallet"})
	info: OrchardMintInfo | null;

	@Field(() => Int, {nullable: true, description: 'Round trip time of the info request in milliseconds'})
	latency_ms: number | null;

	@Field(() => Int, {nullable: true, description: "Seconds the mint's clock is ahead of Orchard's, negative when behind"})
	time_offset: number | null;

	@Field(() => WalletMintMatch, {nullable: true, description: 'How the mint matches one already in the wallet'})
	match: WalletMintMatch | null;

	@Field(() => ID, {nullable: true, description: 'The wallet mint it matches'})
	mint_id: string | null;

	constructor(lookup: CashuWalletMintLookup) {
		this.url = lookup.url;
		this.info = lookup.info ? new OrchardMintInfo(JSON.parse(lookup.info) as CashuMintInfo) : null;
		this.latency_ms = lookup.latency_ms;
		this.time_offset = lookup.time_offset;
		this.match = lookup.match;
		this.mint_id = lookup.mint_id;
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
