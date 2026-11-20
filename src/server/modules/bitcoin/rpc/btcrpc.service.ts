/* Core Dependencies */
import {Injectable, Logger, type OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {BitcoinType} from '#server/modules/bitcoin/bitcoin.enums';
import {CoreService} from '#server/modules/bitcoin/core/core.service';
/* Local Dependencies */
import type {
	BitcoinBlockchainInfo,
	BitcoinNetworkInfo,
	BitcoinBlock,
	BitcoinRawTransaction,
	BitcoinTransaction,
	BitcoinFeeEstimate,
	BitcoinBlockTemplate,
	BitcoinRpcOptions,
	BitcoinTxOut,
} from './btcrpc.types.js';

@Injectable()
export class BitcoinRpcService implements OnModuleInit {
	private readonly logger = new Logger(BitcoinRpcService.name);

	private type: BitcoinType;
	private chain: string; // stores the chain type (main, test, regtest, signet)

	constructor(
		private configService: ConfigService,
		private coreService: CoreService,
	) {}

	public async onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.type = this.configService.get('bitcoin.type');
		this.initializeRpc();
		await this.initializeChain();
	}

	private initializeRpc() {
		if (this.type === BitcoinType.CORE) this.coreService.initializeRpc();
	}

	/**
	 * Fetches and stores the chain type for use in RPC calls that require it
	 * Falls back gracefully if Bitcoin Core is not available during startup
	 */
	private async initializeChain(): Promise<void> {
		try {
			const blockchain_info = await this.getBitcoinBlockchainInfo();
			this.chain = blockchain_info.chain;
			this.logger.log(`Initialized on chain: ${this.chain}`);
		} catch (error) {
			this.logger.warn(`Failed to fetch chain info during init: ${error.message}`);
		}
	}

	/* *******************************************************
	   Blockchain                      
	******************************************************** */

	public async getBitcoinBlockCount(options?: BitcoinRpcOptions): Promise<number> {
		return this.request('getblockcount', [], options);
	}

	public async getBitcoinBlockchainInfo(options?: BitcoinRpcOptions): Promise<BitcoinBlockchainInfo> {
		return this.request('getblockchaininfo', [], options);
	}

	public async getBitcoinBlock(hash: string, options?: BitcoinRpcOptions): Promise<BitcoinBlock> {
		return this.request('getblock', [hash, 2], options);
	}

	public async getBitcoinBlockHash(height: number, options?: BitcoinRpcOptions): Promise<string> {
		return this.request('getblockhash', [height], options);
	}

	public async getBitcoinBlockHeader(hash: string, options?: BitcoinRpcOptions): Promise<any> {
		return this.request('getblockheader', [hash, true], options);
	}

	public async getBitcoinBlockRaw(hash: string, options?: BitcoinRpcOptions): Promise<string> {
		return this.request('getblock', [hash, 0], options);
	}

	/* *******************************************************
	   Network                      
	******************************************************** */

	public async getBitcoinNetworkInfo(options?: BitcoinRpcOptions): Promise<BitcoinNetworkInfo> {
		return this.request('getnetworkinfo', [], options);
	}

	/* *******************************************************
	   Mempool                      
	******************************************************** */

	public async getBitcoinMempool(options?: BitcoinRpcOptions): Promise<Record<string, BitcoinTransaction>> {
		return this.request('getrawmempool', [true], options);
	}

	/* *******************************************************
	    Transaction                      
	******************************************************** */

	public async getTransaction(txid: string, options?: BitcoinRpcOptions): Promise<BitcoinRawTransaction> {
		return this.request('getrawtransaction', [txid, true], options);
	}

	/** An output still unspent in the chain or mempool with its confirmations, 0 in the mempool; null once spent or unknown */
	public async getBitcoinTxOut(txid: string, vout: number, options?: BitcoinRpcOptions): Promise<BitcoinTxOut | null> {
		return this.request('gettxout', [txid, vout, true], options);
	}

	/* *******************************************************
	   Mining                      
	******************************************************** */

	public async getBitcoinBlockTemplate(options?: BitcoinRpcOptions): Promise<BitcoinBlockTemplate> {
		if (this.type === BitcoinType.CORE && !this.chain) {
			const blockchain_info = await this.getBitcoinBlockchainInfo(options);
			this.chain = blockchain_info.chain;
		}
		const rules = ['segwit'];
		if (this.chain === 'signet') rules.push('signet');
		return this.request('getblocktemplate', [{rules, mode: 'template'}], options);
	}

	/* *******************************************************
	   Utilities
	******************************************************** */

	public async getBitcoinFeeEstimate(target: number, options?: BitcoinRpcOptions): Promise<BitcoinFeeEstimate> {
		return this.request('estimatesmartfee', [target], options);
	}

	/**
	 * Gets the timestamp for a block at a given height
	 * @param height Block height
	 * @returns Unix timestamp of the block, or null if unavailable
	 */
	public async getBlockTimestamp(height: number): Promise<number | null> {
		if (this.type !== BitcoinType.CORE) return null;
		try {
			const hash = await this.getBitcoinBlockHash(height);
			const header = await this.getBitcoinBlockHeader(hash);
			return header?.time ?? null;
		} catch {
			return null;
		}
	}

	/**
	 * Checks if Bitcoin RPC is configured and available
	 */
	public isConfigured(): boolean {
		return this.type === BitcoinType.CORE;
	}

	/** A call to the configured node; with none, a strict caller gets an error and the rest nothing */
	private async request(method: string, params: unknown[], options: BitcoinRpcOptions = {}): Promise<any> {
		if (this.type === BitcoinType.CORE) return this.coreService.makeRpcRequest(method, params, options);
		if (options.strict) throw new Error('No Bitcoin node configured');
	}
}
