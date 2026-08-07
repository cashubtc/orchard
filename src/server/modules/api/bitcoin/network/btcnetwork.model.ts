/* Core Dependencies */
import {Field, Int, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {BitcoinNetworkInfo} from '#server/modules/bitcoin/rpc/btcrpc.types';

@ObjectType({description: 'Bitcoin network type configuration'})
export class OrchardBitcoinNetwork {
	@Field(() => String, {description: 'Network name (ipv4, ipv6, onion, i2p, cjdns)'})
	name: string;

	@Field(() => Boolean, {description: 'Whether the network is limited'})
	limited: boolean;

	@Field(() => Boolean, {description: 'Whether the network is reachable'})
	reachable: boolean;

	@Field(() => String, {description: 'Proxy address for this network'})
	proxy: string;

	@Field(() => Boolean, {description: 'Whether proxy credentials are randomized per connection'})
	proxy_randomize_credentials: boolean;

	constructor(bn: BitcoinNetworkInfo['networks'][number]) {
		this.name = bn.name;
		this.limited = bn.limited;
		this.reachable = bn.reachable;
		this.proxy = bn.proxy;
		this.proxy_randomize_credentials = bn.proxy_randomize_credentials;
	}
}

@ObjectType({description: 'Bitcoin local network address'})
export class OrchardBitcoinNetworkAddress {
	@Field(() => String, {description: 'Local network address'})
	address: string;

	@Field(() => Int, {description: 'Listening port number'})
	port: number;

	@Field(() => Int, {description: 'Address score'})
	score: number;

	constructor(ban: BitcoinNetworkInfo['localaddresses'][number]) {
		this.address = ban.address;
		this.port = ban.port;
		this.score = ban.score;
	}
}

@ObjectType({description: 'Bitcoin peer-to-peer network information'})
export class OrchardBitcoinNetworkInfo {
	@Field(() => Int, {description: 'Node software version as an integer'})
	version: number;

	@Field(() => String, {description: 'Node user agent string'})
	subversion: string;

	@Field(() => Int, {description: 'Protocol version number'})
	protocolversion: number;

	@Field(() => String, {description: 'Services offered by this node in hex'})
	localservices: string;

	@Field(() => [String], {description: 'Names of services offered by this node'})
	localservicesnames: string[];

	@Field(() => Boolean, {description: 'Whether transaction relay is enabled'})
	localrelay: boolean;

	@Field(() => Int, {description: 'Time offset from network-adjusted time in seconds'})
	timeoffset: number;

	@Field(() => Int, {description: 'Total number of peer connections'})
	connections: number;

	@Field(() => Int, {description: 'Number of inbound peer connections'})
	connections_in: number;

	@Field(() => Int, {description: 'Number of outbound peer connections'})
	connections_out: number;

	@Field(() => Boolean, {description: 'Whether the network is active'})
	networkactive: boolean;

	@Field(() => [OrchardBitcoinNetwork], {description: 'Available network types and their status'})
	networks: OrchardBitcoinNetwork[];

	@Field(() => Float, {description: 'Minimum relay fee in BTC/kB'})
	relayfee: number;

	@Field(() => Float, {description: 'Minimum incremental fee for mempool limiting in BTC/kB'})
	incrementalfee: number;

	@Field(() => [OrchardBitcoinNetworkAddress], {description: 'Local addresses being listened on'})
	localaddresses: OrchardBitcoinNetworkAddress[];

	@Field(() => [String], {description: 'Active network warnings'})
	warnings: string[];

	@Field(() => Boolean, {description: 'Whether this node is a backend connection'})
	backend: boolean;

	constructor(bni: BitcoinNetworkInfo, backend: boolean = false) {
		this.version = bni.version;
		this.subversion = bni.subversion;
		this.protocolversion = bni.protocolversion;
		this.localservices = bni.localservices;
		this.localservicesnames = bni.localservicesnames;
		this.localrelay = bni.localrelay;
		this.timeoffset = bni.timeoffset;
		this.connections = bni.connections;
		this.connections_in = bni.connections_in;
		this.connections_out = bni.connections_out;
		this.networkactive = bni.networkactive;
		this.networks = bni.networks;
		this.relayfee = bni.relayfee;
		this.incrementalfee = bni.incrementalfee;
		this.localaddresses = bni.localaddresses;
		this.warnings = Array.isArray(bni.warnings) ? bni.warnings : [bni.warnings];
		this.backend = backend;
	}
}
