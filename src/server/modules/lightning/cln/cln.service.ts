/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import * as path from 'path';
/* Vendor Dependencies */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
/* Application Dependencies */
import {CredentialService} from '#server/modules/credential/credential.service';
/* Native Dependencies */
import type {LightningInfo, LightningChannelBalance, LightningRequest} from '#server/modules/lightning/lightning/lightning.types';
import type {LightningAddresses} from '#server/modules/lightning/walletkit/lnwalletkit.types';
import {LightningAddressType} from '#server/modules/lightning/lightning.enums';
/* Local Dependencies */
import {asBigIntMsat, sumMsat, mapRequestType, mapRequestExpiry, mapRequestDescription} from './cln.helpers.js';

@Injectable()
export class ClnService {
	private readonly logger = new Logger(ClnService.name);
	private lightning_client: grpc.Client | null = null;

	constructor(
		private configService: ConfigService,
		private credentialService: CredentialService,
	) {}

	private createGrpcCredentials() {
		const rpc_host = this.configService.get('lightning.host');
		const rpc_port = this.configService.get('lightning.port');
		const client_cert = this.configService.get('lightning.cert');
		const client_key = this.configService.get('lightning.key');
		const ca_cert = this.configService.get('lightning.ca');

		if (!rpc_host || !rpc_port || !client_cert || !client_key || !ca_cert) {
			this.logger.warn('Missing CLN gRPC mTLS credentials, secure connection cannot be established');
			return null;
		}

		const rpc_url = `${rpc_host}:${rpc_port}`;
		const ca_cert_content = this.credentialService.loadPemOrPath(ca_cert);
		const client_cert_content = this.credentialService.loadPemOrPath(client_cert);
		const client_key_content = this.credentialService.loadPemOrPath(client_key);

		if (!ca_cert_content || !client_cert_content || !client_key_content) {
			const missing = [
				!ca_cert_content && 'CA certificate',
				!client_cert_content && 'client certificate',
				!client_key_content && 'client key',
			]
				.filter(Boolean)
				.join(', ');
			this.logger.error(`Failed to load CLN mTLS credential(s): ${missing} — check that the file paths exist and are readable`);
			return null;
		}

		const ssl_creds = grpc.credentials.createSsl(ca_cert_content, client_key_content, client_cert_content);

		let channel_options: Record<string, any> | undefined = undefined;
		if (rpc_host?.includes('host.docker.internal')) {
			channel_options = {
				'grpc.ssl_target_name_override': 'cln',
				'grpc.default_authority': 'cln',
			};
		} else {
			channel_options = {
				'grpc.ssl_target_name_override': 'localhost',
				'grpc.default_authority': 'localhost',
			};
		}

		return {rpc_url, creds: ssl_creds, channel_options};
	}

	private initializeGrpcClient(proto_paths: string[], package_namespace: string, client_class: string): grpc.Client {
		const credentials = this.createGrpcCredentials();
		if (!credentials) return;

		try {
			const package_definition = protoLoader.loadSync(proto_paths, {
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			});
			const grpc_package: any = grpc.loadPackageDefinition(package_definition)[package_namespace];
			this.logger.log(`${client_class} gRPC client initialized with mTLS`);
			return new grpc_package[client_class](credentials.rpc_url, credentials.creds, credentials.channel_options);
		} catch (error) {
			this.logger.error(`Failed to initialize ${client_class} gRPC client: ${error.message}`);
			throw error;
		}
	}

	public initializeLightningClient(): grpc.Client {
		if (this.lightning_client) return this.lightning_client;
		const node_proto_path = path.join(process.cwd(), 'proto/cln/node.proto');
		const primitives_proto_path = path.join(process.cwd(), 'proto/cln/primitives.proto');
		return (this.lightning_client = this.initializeGrpcClient([node_proto_path, primitives_proto_path], 'cln', 'Node'));
	}

	public initializeWalletKitClient(): grpc.Client {
		return this.initializeLightningClient();
	}

	public async mapClnInfo(info: any): Promise<LightningInfo> {
		const toHex = (v: any): string => {
			if (v == null) return '';
			if (Buffer.isBuffer(v)) return v.toString('hex');
			if (typeof v === 'string') return v.replace(/^#/, '');
			return '';
		};

		const id_hex = toHex(info?.id);
		// Canonical color format is '#rrggbb' — lnd's getinfo already emits
		// the leading '#' and passes through untouched; clients bind the
		// string directly to CSS background-color, so bare hex renders
		// transparent. Normalize cln (bare hex from getinfo) to match.
		const color_bare = toHex(info?.color).toLowerCase();
		const color_hex = color_bare === '' ? '' : `#${color_bare}`;
		const network: string = info?.network ?? '';
		const addresses: any[] = Array.isArray(info?.address) ? info.address : [];

		const uris: string[] = addresses
			.map((a: any) => {
				const addr = a?.address;
				const port = a?.port;
				if (!id_hex || !addr || !port) return null;
				return `${id_hex}@${addr}:${port}`;
			})
			.filter((x: string | null): x is string => !!x);

		return {
			version: info?.version ?? '',
			commit_hash: '',
			identity_pubkey: id_hex,
			alias: info?.alias ?? '',
			color: color_hex,
			num_pending_channels: info?.num_pending_channels ?? 0,
			num_active_channels: info?.num_active_channels ?? 0,
			num_inactive_channels: info?.num_inactive_channels ?? 0,
			num_peers: info?.num_peers ?? 0,
			block_height: info?.blockheight ?? 0,
			block_hash: '',
			best_header_timestamp: 0,
			synced_to_chain: true,
			synced_to_graph: true,
			testnet: !(network === 'bitcoin' || network === 'mainnet'),
			chains: [{chain: 'bitcoin', network}],
			uris,
			require_htlc_interceptor: false,
			store_final_htlc_resolutions: false,
			features: {},
		};
	}

	public async mapClnChannelBalance(funds: any, peers: any): Promise<LightningChannelBalance> {
		const open_states = new Set(['ChanneldNormal']);
		const pending_states = new Set([
			'Openingd',
			'ChanneldAwaitingLockin',
			'DualopendOpenInit',
			'DualopendAwaitingLockin',
			'ChanneldAwaitingSplice',
			'DualopendOpenCommitted',
			'DualopendOpenCommittReady',
		]);

		const fund_chans = funds?.channels ?? [];
		const peer_chans = peers?.channels ?? [];

		const open_fund_chans = fund_chans.filter((c: any) => open_states.has(c.state));
		const pending_fund_chans = fund_chans.filter((c: any) => pending_states.has(c.state));
		const open_peer_chans = peer_chans.filter((c: any) => open_states.has(c.state));

		let local_open_msat = sumMsat(open_peer_chans, (c: any) => c.to_us_msat ?? 0);
		if (local_open_msat === BigInt(0)) {
			local_open_msat = sumMsat(open_fund_chans, (c: any) => c.our_amount_msat ?? 0);
		}

		let remote_open_msat = BigInt(0);
		for (const c of open_peer_chans) {
			const total = asBigIntMsat(c.total_msat);
			const to_us = asBigIntMsat(c.to_us_msat);
			if (total > BigInt(0)) remote_open_msat += total - to_us;
		}
		if (remote_open_msat === BigInt(0)) {
			for (const c of open_fund_chans) {
				const total = asBigIntMsat(c.amount_msat);
				const ours = asBigIntMsat(c.our_amount_msat);
				if (total > BigInt(0)) remote_open_msat += total - ours;
			}
		}

		let unsettled_local_msat = BigInt(0);
		let unsettled_remote_msat = BigInt(0);
		for (const c of open_peer_chans) {
			for (const h of c.htlcs || []) {
				const amt = asBigIntMsat(h.amount_msat);
				const dir = h.direction; // 'IN' | 'OUT'
				if (dir === 'OUT') unsettled_local_msat += BigInt(amt);
				else if (dir === 'IN') unsettled_remote_msat += BigInt(amt);
			}
		}

		const pending_local_msat = sumMsat(pending_fund_chans, (c: any) => c.our_amount_msat);
		let pending_remote_msat = BigInt(0);
		for (const c of pending_fund_chans) {
			const total = asBigIntMsat(c.amount_msat);
			const ours = asBigIntMsat(c.our_amount_msat);
			if (total > BigInt(0)) pending_remote_msat += total - ours;
		}

		return {
			balance: (local_open_msat / BigInt(1000)).toString(),
			pending_open_balance: (pending_local_msat / BigInt(1000)).toString(),
			local_balance: local_open_msat.toString(),
			remote_balance: remote_open_msat.toString(),
			unsettled_local_balance: unsettled_local_msat.toString(),
			unsettled_remote_balance: unsettled_remote_msat.toString(),
			pending_open_local_balance: pending_local_msat.toString(),
			pending_open_remote_balance: pending_remote_msat.toString(),
			custom_channel_data: Buffer.alloc(0),
		};
	}

	/**
	 * Maps CLN addresses and funds to the LightningAddresses format
	 * Combines address list with UTXO outputs to get per-address balances
	 * @param {any} addresses - CLN ListAddresses response
	 * @param {any} funds - CLN ListFunds response
	 * @returns {LightningAddresses} Mapped addresses with balances
	 */
	public mapClnAddresses(addresses: any, funds: any): LightningAddresses {
		const entries: any[] = Array.isArray(addresses?.addresses) ? addresses.addresses : [];
		const outputs: any[] = Array.isArray(funds?.outputs) ? funds.outputs : [];

		// Build a map of address -> total balance (in sats)
		const balance_map = new Map<string, number>();
		for (const output of outputs) {
			const addr = output?.address;
			if (!addr) continue;
			// amount_msat is in millisatoshis, convert to sats
			const amount_msat = output?.amount_msat?.msat ?? output?.amount_msat ?? 0;
			const amount_sat = Math.floor(Number(amount_msat) / 1000);
			balance_map.set(addr, (balance_map.get(addr) ?? 0) + amount_sat);
		}

		const mkAddress = (addr: string) => ({
			address: addr,
			is_internal: 'false',
			balance: balance_map.get(addr) ?? 0,
			derivation_path: '',
			public_key: Buffer.alloc(0),
		});

		const bech32 = entries.map((e) => e?.bech32).filter((x: string) => !!x);
		const p2tr = entries.map((e) => e?.p2tr).filter((x: string) => !!x);
		const account_with_addresses: LightningAddresses['account_with_addresses'] = [];

		if (bech32.length) {
			account_with_addresses.push({
				name: 'bech32',
				address_type: LightningAddressType.WITNESS_PUBKEY_HASH,
				derivation_path: '',
				addresses: bech32.map(mkAddress),
			});
		}

		if (p2tr.length) {
			account_with_addresses.push({
				name: 'p2tr',
				address_type: LightningAddressType.TAPROOT_PUBKEY,
				derivation_path: '',
				addresses: p2tr.map(mkAddress),
			});
		}

		return {account_with_addresses};
	}

	public mapClnRequest(request: any): LightningRequest {
		// BOLT11 decode populates `payee`; BOLT12 offers populate
		// `offer_issuer_id` (the node the offer requests payment to) instead.
		// Both identify the issuing node for backend-detection purposes, so
		// we fall back rather than returning null on bolt12 offers. Field
		// verified via `lightning-cli decode` on CLN 25.12 — the bolt12
		// offer payload carries offer_issuer_id (not offer_node_id as older
		// CLN docs sometimes claim).
		const node_id = request?.payee ?? request?.offer_issuer_id;
		const destination = node_id ? (Buffer.isBuffer(node_id) ? node_id.toString('hex') : String(node_id)) : null;
		return {
			type: mapRequestType(request?.item_type),
			valid: request?.valid ?? false,
			destination,
			expiry: mapRequestExpiry(request),
			description: mapRequestDescription(request?.description),
			offer_quantity_max: request?.offer_quantity_max ?? null,
		};
	}
}
