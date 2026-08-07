/* Core Dependencies */
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {LightningType} from '#server/modules/lightning/lightning.enums';
import {LndService} from '#server/modules/lightning/lnd/lnd.service';
import {ClnService} from '#server/modules/lightning/cln/cln.service';
/* Local Dependencies */
import {
	LightningInfo,
	LightningChannelBalance,
	LightningRequest,
	LightningPayment,
	LightningInvoice,
	LightningForward,
	LightningChannel,
	LightningClosedChannel,
	LightningTransaction,
	LightningHistoryArgs,
	LightningPaginatedResult,
	LightningPeer,
} from './lightning.types.js';
import {
	mapLndPayments,
	mapLndInvoices,
	mapLndForwards,
	mapLndChannels,
	mapLndClosedChannels,
	mapLndTransactions,
	mapLndPeers,
} from '#server/modules/lightning/lnd/lnd.helpers';
import {
	mapClnPayments,
	mapClnInvoices,
	mapClnForwards,
	mapClnChannels,
	mapClnClosedChannels,
	mapClnTransactions,
	mapClnPeers,
} from '#server/modules/lightning/cln/cln.helpers';

@Injectable()
export class LightningService implements OnModuleInit {
	private readonly logger = new Logger(LightningService.name);

	private grpc_client: any = null;
	private type: LightningType;

	constructor(
		private configService: ConfigService,
		private bitcoinRpcService: BitcoinRpcService,
		private lndService: LndService,
		private clnService: ClnService,
	) {}

	public async onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.type = this.configService.get('lightning.type');
		this.initializeGrpcClients();
	}

	private initializeGrpcClients() {
		if (this.type === 'lnd') this.grpc_client = this.lndService.initializeLightningClient();
		if (this.type === 'cln') this.grpc_client = this.clnService.initializeLightningClient();
	}

	private makeGrpcRequest(method: string, request: any): Promise<any> {
		if (!this.grpc_client) throw OrchardErrorCode.LightningRpcConnectionError;

		return new Promise((resolve, reject) => {
			if (!(method in this.grpc_client)) reject(OrchardErrorCode.LightningSupportError);
			this.grpc_client[method](request, (error: Error | null, response: any) => {
				if (error) this.logger.debug('error', error);
				if (error && error?.message?.includes('14 UNAVAILABLE')) reject(OrchardErrorCode.LightningRpcConnectionError);
				if (error) reject(error);
				resolve(response);
			});
		});
	}

	async getLightningInfo(): Promise<LightningInfo> {
		if (this.type === 'lnd') return this.makeGrpcRequest('GetInfo', {});
		if (this.type === 'cln') return this.clnService.mapClnInfo(await this.makeGrpcRequest('Getinfo', {}));
	}

	async getLightningChannelBalance(): Promise<LightningChannelBalance> {
		if (this.type === 'lnd') return this.lndService.mapLndChannelBalance(await this.makeGrpcRequest('ChannelBalance', {}));
		if (this.type === 'cln') {
			return this.clnService.mapClnChannelBalance(
				await this.makeGrpcRequest('ListFunds', {}),
				await this.makeGrpcRequest('ListPeerChannels', {}),
			);
		}
	}

	async getLightningRequest(request: string): Promise<LightningRequest> {
		if (this.type === 'lnd') return this.lndService.mapLndRequest(await this.makeGrpcRequest('DecodePayReq', {pay_req: request}));
		if (this.type === 'cln') return this.clnService.mapClnRequest(await this.makeGrpcRequest('Decode', {string: request}));
	}

	/**
	 * Gets currently open channels from the Lightning node
	 */
	async getChannels(): Promise<LightningChannel[]> {
		if (this.type === 'lnd') return mapLndChannels(await this.makeGrpcRequest('ListChannels', {peer_alias_lookup: true}));
		if (this.type === 'cln') return mapClnChannels(await this.makeGrpcRequest('ListPeerChannels', {}));
		return [];
	}

	/**
	 * Gets closed channels from the Lightning node
	 */
	async getClosedChannels(): Promise<LightningClosedChannel[]> {
		if (this.type === 'lnd') return mapLndClosedChannels(await this.makeGrpcRequest('ClosedChannels', {}));
		if (this.type === 'cln') return mapClnClosedChannels(await this.makeGrpcRequest('ListClosedChannels', {}));
		return [];
	}

	/**
	 * Gets connected peers from the Lightning node
	 */
	async getPeers(): Promise<LightningPeer[]> {
		if (this.type === 'lnd') return mapLndPeers(await this.makeGrpcRequest('ListPeers', {}));
		if (this.type === 'cln') return mapClnPeers(await this.makeGrpcRequest('ListPeers', {}));
		return [];
	}

	/**
	 * Gets the alias for a node by its public key
	 * LND: GetNodeInfo, CLN: ListNodes with id filter
	 */
	async getNodeAlias(pubkey: string): Promise<string | null> {
		try {
			if (this.type === 'lnd') {
				const info = await this.makeGrpcRequest('GetNodeInfo', {pub_key: pubkey, include_channels: false});
				return info?.node?.alias || null;
			}
			if (this.type === 'cln') {
				const response = await this.makeGrpcRequest('ListNodes', {id: Buffer.from(pubkey, 'hex')});
				return response?.nodes?.[0]?.alias || null;
			}
		} catch {
			return null;
		}
	}

	/**
	 * Gets on-chain transactions from the Lightning node wallet
	 * Used primarily for looking up funding transaction timestamps
	 */
	async getTransactions(): Promise<LightningTransaction[]> {
		if (this.type === 'lnd') {
			return mapLndTransactions(await this.makeGrpcRequest('GetTransactions', {}));
		}
		if (this.type === 'cln') {
			const transactions = mapClnTransactions(await this.makeGrpcRequest('ListTransactions', {}));
			return this.enrichClnTransactionTimestamps(transactions);
		}
		return [];
	}

	/**
	 * Gets outgoing payments from the Lightning node
	 * @param args Optional filtering and pagination arguments
	 */
	async getPayments(args?: LightningHistoryArgs): Promise<LightningPaginatedResult<LightningPayment>> {
		if (this.type === 'lnd') {
			const request = {
				include_incomplete: true,
				index_offset: args?.index_offset ? String(args.index_offset) : '0',
				max_payments: args?.max_results ? String(args.max_results) : '1000',
				creation_date_start: args?.start_time ? String(args.start_time) : undefined,
				creation_date_end: args?.end_time ? String(args.end_time) : undefined,
			};
			return mapLndPayments(await this.makeGrpcRequest('ListPayments', request));
		}
		if (this.type === 'cln') {
			// CLN pagination: index is enum (CREATED/UPDATED), start is offset position
			// Both index and limit must be specified together
			const request: any = {};
			if (args?.max_results) {
				request.index = 'CREATED';
				request.start = args?.index_offset ?? 0;
				request.limit = args.max_results;
			}
			return mapClnPayments(await this.makeGrpcRequest('ListPays', request), args?.index_offset ?? 0);
		}
		return {data: [], last_offset: 0};
	}

	/**
	 * Gets incoming invoices from the Lightning node
	 * @param args Optional filtering and pagination arguments
	 */
	async getInvoices(args?: LightningHistoryArgs): Promise<LightningPaginatedResult<LightningInvoice>> {
		if (this.type === 'lnd') {
			const request = {
				index_offset: args?.index_offset ? String(args.index_offset) : '0',
				num_max_invoices: args?.max_results ?? 1000,
				creation_date_start: args?.start_time ? String(args.start_time) : undefined,
				creation_date_end: args?.end_time ? String(args.end_time) : undefined,
			};
			return mapLndInvoices(await this.makeGrpcRequest('ListInvoices', request));
		}
		if (this.type === 'cln') {
			// CLN pagination: index is enum (CREATED/UPDATED), start is offset position
			// Both index and limit must be specified together
			const request: any = {};
			if (args?.max_results) {
				request.index = 'CREATED';
				request.start = args?.index_offset ?? 0;
				request.limit = args.max_results;
			}
			return mapClnInvoices(await this.makeGrpcRequest('ListInvoices', request), args?.index_offset ?? 0);
		}
		return {data: [], last_offset: 0};
	}

	/**
	 * Gets forwarding events (routing) from the Lightning node
	 * @param args Optional filtering and pagination arguments
	 */
	async getForwards(args?: LightningHistoryArgs): Promise<LightningPaginatedResult<LightningForward>> {
		if (this.type === 'lnd') {
			const request = {
				start_time: args?.start_time,
				end_time: args?.end_time,
				index_offset: args?.index_offset ?? 0,
				num_max_events: args?.max_results ?? 1000,
			};
			return mapLndForwards(await this.makeGrpcRequest('ForwardingHistory', request));
		}
		if (this.type === 'cln') {
			// CLN pagination: index is enum (CREATED/UPDATED), start is offset position
			// Both index and limit must be specified together
			const request: any = {status: 'SETTLED'};
			if (args?.max_results) {
				request.index = 'CREATED';
				request.start = args?.index_offset ?? 0;
				request.limit = args.max_results;
			}
			return mapClnForwards(await this.makeGrpcRequest('ListForwards', request), args?.index_offset ?? 0);
		}
		return {data: [], last_offset: 0};
	}

	/**
	 * Enriches CLN transactions with timestamps from Bitcoin RPC or estimation
	 * CLN doesn't provide timestamps in ListTransactions, only blockheight
	 */
	private async enrichClnTransactionTimestamps(transactions: LightningTransaction[]): Promise<LightningTransaction[]> {
		// Bitcoin genesis timestamp (block 0)
		const GENESIS_TIMESTAMP = 1231006505;
		const AVG_BLOCK_TIME = 600; // 10 minutes in seconds

		// Try to get current block info for better estimation
		let current_block_height: number | null = null;
		let current_timestamp: number | null = null;

		if (this.bitcoinRpcService.isConfigured()) {
			try {
				const block_count = await this.bitcoinRpcService.getBitcoinBlockCount();
				current_block_height = block_count;
				current_timestamp = Math.floor(Date.now() / 1000);
			} catch {
				// Fall back to estimation
			}
		}

		for (const tx of transactions) {
			if (tx.time_stamp > 0) continue; // Already has timestamp
			if (!tx.block_height) continue; // No block height to work with

			// Try Bitcoin RPC first
			if (this.bitcoinRpcService.isConfigured()) {
				try {
					const timestamp = await this.bitcoinRpcService.getBlockTimestamp(tx.block_height);
					if (timestamp) {
						tx.time_stamp = timestamp;
						continue;
					}
				} catch {
					// Fall through to estimation
				}
			}

			// Estimate timestamp from blockheight
			if (current_block_height && current_timestamp) {
				// Estimate backwards from current block
				const blocks_ago = current_block_height - tx.block_height;
				tx.time_stamp = current_timestamp - blocks_ago * AVG_BLOCK_TIME;
			} else {
				// Estimate forwards from genesis
				tx.time_stamp = GENESIS_TIMESTAMP + tx.block_height * AVG_BLOCK_TIME;
			}
		}

		return transactions;
	}

	/**
	 * Determines the node's birthdate by finding the earliest funding transaction
	 * Falls back to January 1, 2018 if no transactions found (e.g., remote-opened channels)
	 * @returns Unix timestamp in seconds of the earliest channel funding
	 */
	async getNodeBirthdate(): Promise<number> {
		// Fallback: January 1, 2018 00:00:00 UTC (Lightning Network mainnet launched March 2018)
		const FALLBACK_BIRTHDATE = 1514764800;

		const [open_channels, closed_channels, transactions] = await Promise.all([
			this.getChannels(),
			this.getClosedChannels(),
			this.getTransactions(),
		]);

		const tx_map = new Map<string, number>();
		for (const tx of transactions) {
			if (tx.tx_hash && tx.time_stamp > 0) {
				tx_map.set(tx.tx_hash, tx.time_stamp);
			}
		}

		let earliest = Number.MAX_SAFE_INTEGER;

		for (const channel of open_channels) {
			const timestamp = tx_map.get(channel.funding_txid);
			if (timestamp && timestamp < earliest) {
				earliest = timestamp;
			}
		}

		for (const channel of closed_channels) {
			const timestamp = tx_map.get(channel.funding_txid);
			if (timestamp && timestamp < earliest) {
				earliest = timestamp;
			}
		}

		if (earliest === Number.MAX_SAFE_INTEGER) {
			this.logger.debug('No funding transactions found in wallet, using fallback birthdate (2018-01-01)');
			return FALLBACK_BIRTHDATE;
		}

		return earliest;
	}

	/**
	 * Checks if lightning is configured and available
	 */
	isConfigured(): boolean {
		return this.type != null && this.grpc_client != null;
	}

	/**
	 * Gets all payments with automatic pagination
	 */
	async getAllPayments(args?: Omit<LightningHistoryArgs, 'index_offset' | 'max_results'>): Promise<LightningPayment[]> {
		const all_payments: LightningPayment[] = [];
		const batch_size = 1000;
		let offset = 0;

		while (true) {
			const result = await this.getPayments({...args, index_offset: offset, max_results: batch_size});
			all_payments.push(...result.data);
			if (result.data.length < batch_size) break;
			offset = result.last_offset;
		}

		return all_payments;
	}

	/**
	 * Gets all invoices with automatic pagination
	 */
	async getAllInvoices(args?: Omit<LightningHistoryArgs, 'index_offset' | 'max_results'>): Promise<LightningInvoice[]> {
		const all_invoices: LightningInvoice[] = [];
		const batch_size = 1000;
		let offset = 0;

		while (true) {
			const result = await this.getInvoices({...args, index_offset: offset, max_results: batch_size});
			all_invoices.push(...result.data);
			if (result.data.length < batch_size) break;
			offset = result.last_offset;
		}

		return all_invoices;
	}

	/**
	 * Gets all forwards with automatic pagination
	 */
	async getAllForwards(args?: Omit<LightningHistoryArgs, 'index_offset' | 'max_results'>): Promise<LightningForward[]> {
		const all_forwards: LightningForward[] = [];
		const batch_size = 1000;
		let offset = 0;

		while (true) {
			const result = await this.getForwards({...args, index_offset: offset, max_results: batch_size});
			all_forwards.push(...result.data);
			if (result.data.length < batch_size) break;
			offset = result.last_offset;
		}

		return all_forwards;
	}
}
