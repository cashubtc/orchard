/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import type {TaprootAssetsInfo} from '#server/modules/tapass/tapass/tapass.types';

@ObjectType({description: 'Taproot Assets daemon information'})
export class OrchardTaprootAssetsInfo {
	@Field(() => String, {description: 'Taproot Assets daemon version'})
	version: string;

	@Field(() => String, {description: 'Connected LND version'})
	lnd_version: string;

	@Field(() => String, {description: 'Active Bitcoin network'})
	network: string;

	@Field(() => String, {description: 'LND node identity public key'})
	lnd_identity_pubkey: string;

	@Field(() => String, {description: 'LND node alias'})
	node_alias: string;

	@Field(() => Int, {description: 'Current block height'})
	block_height: number;

	@Field(() => String, {description: 'Current block hash'})
	block_hash: string;

	@Field(() => Boolean, {description: 'Whether the node is synced to the chain'})
	sync_to_chain: boolean;

	constructor(ta_info: TaprootAssetsInfo) {
		this.version = ta_info.version;
		this.lnd_version = ta_info.lnd_version;
		this.network = ta_info.network;
		this.lnd_identity_pubkey = ta_info.lnd_identity_pubkey;
		this.node_alias = ta_info.node_alias;
		this.block_height = ta_info.block_height;
		this.block_hash = ta_info.block_hash;
		this.sync_to_chain = ta_info.sync_to_chain;
	}
}
