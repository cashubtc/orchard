/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import type {LightningInfo} from '#server/modules/lightning/lightning/lightning.types';

@ObjectType({description: 'Lightning node general information'})
export class OrchardLightningInfo {
	@Field(() => String, {description: 'Software version of the lightning node'})
	version: string;

	@Field(() => String, {description: 'Git commit hash of the running build'})
	commit_hash: string;

	@Field(() => String, {description: 'Public key identity of the lightning node'})
	identity_pubkey: string;

	@Field(() => String, {description: 'Node alias visible on the network'})
	alias: string;

	@Field(() => String, {description: 'Hex color code for the node'})
	color: string;

	@Field(() => Int, {description: 'Number of channels pending to open'})
	num_pending_channels: number;

	@Field(() => Int, {description: 'Number of currently active channels'})
	num_active_channels: number;

	@Field(() => Int, {description: 'Number of currently inactive channels'})
	num_inactive_channels: number;

	@Field(() => Int, {description: 'Number of connected peers'})
	num_peers: number;

	@Field(() => Int, {description: 'Current best known block height'})
	block_height: number;

	@Field(() => String, {description: 'Hash of the current best known block'})
	block_hash: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the best known block header'})
	best_header_timestamp: number;

	@Field(() => Boolean, {description: 'Whether the node is synced to the blockchain'})
	synced_to_chain: boolean;

	@Field(() => Boolean, {description: 'Whether the node is synced to the network graph'})
	synced_to_graph: boolean;

	@Field(() => Boolean, {description: 'Whether the node is running on testnet'})
	testnet: boolean;

	@Field(() => [OrchardLightningChain], {description: 'Blockchain networks the node is connected to'})
	chains: OrchardLightningChain[];

	@Field(() => [String], {description: 'Network addresses where the node can be reached'})
	uris: string[];

	@Field(() => [OrchardLightningFeature], {description: 'Feature bits supported by the node'})
	features: OrchardLightningFeature[];

	@Field(() => Boolean, {description: 'Whether HTLC interceptor is required'})
	require_htlc_interceptor: boolean;

	@Field(() => Boolean, {description: 'Whether final HTLC resolutions are stored'})
	store_final_htlc_resolutions: boolean;

	@Field(() => Boolean, {description: 'Whether this node serves as a backend'})
	backend: boolean;

	constructor(ln_info: LightningInfo, backend: boolean = false) {
		this.version = ln_info.version;
		this.commit_hash = ln_info.commit_hash;
		this.identity_pubkey = ln_info.identity_pubkey;
		this.alias = ln_info.alias;
		this.color = ln_info.color?.startsWith('#') ? ln_info.color : `#${ln_info.color}`;
		this.num_pending_channels = ln_info.num_pending_channels;
		this.num_active_channels = ln_info.num_active_channels;
		this.num_inactive_channels = ln_info.num_inactive_channels;
		this.num_peers = ln_info.num_peers;
		this.block_height = ln_info.block_height;
		this.block_hash = ln_info.block_hash;
		this.best_header_timestamp = ln_info.best_header_timestamp;
		this.synced_to_chain = ln_info.synced_to_chain;
		this.synced_to_graph = ln_info.synced_to_graph;
		this.testnet = ln_info.testnet;
		this.chains = ln_info.chains.map((chain) => new OrchardLightningChain(chain));
		this.uris = ln_info.uris;
		this.features = Object.entries(ln_info.features).map(([bit, feature]) => new OrchardLightningFeature(feature, bit));
		this.require_htlc_interceptor = ln_info.require_htlc_interceptor;
		this.store_final_htlc_resolutions = ln_info.store_final_htlc_resolutions;
		this.backend = backend;
	}
}

@ObjectType({description: 'Blockchain network the lightning node is connected to'})
export class OrchardLightningChain {
	@Field(() => String, {description: 'Blockchain name (e.g. bitcoin)'})
	chain: string;

	@Field(() => String, {description: 'Network type (e.g. mainnet, testnet)'})
	network: string;

	constructor(chain: LightningInfo['chains'][number]) {
		this.chain = chain.chain;
		this.network = chain.network;
	}
}

@ObjectType({description: 'Lightning node feature bit'})
export class OrchardLightningFeature {
	@Field(() => Int, {description: 'Feature bit number'})
	bit: number;

	@Field(() => String, {description: 'Human-readable feature name'})
	name: string;

	@Field(() => Boolean, {description: 'Whether this feature is required for peers'})
	is_required: boolean;

	@Field(() => Boolean, {description: 'Whether this feature is recognized by the node'})
	is_known: boolean;

	constructor(feature: LightningInfo['features'][number], bit: string) {
		this.bit = parseInt(bit);
		this.name = feature.name;
		this.is_required = feature.is_required;
		this.is_known = feature.is_known;
	}
}
