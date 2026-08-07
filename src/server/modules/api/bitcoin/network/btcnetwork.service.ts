/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {LightningService} from '@server/modules/lightning/lightning/lightning.service';
/* Local Dependencies */
import {OrchardBitcoinNetworkInfo} from './btcnetwork.model.js';

@Injectable()
export class BitcoinNetworkService {
	private readonly logger = new Logger(OrchardBitcoinNetworkInfo.name);

	constructor(
		private bitcoinRpcService: BitcoinRpcService,
		private lightningService: LightningService,
		private errorService: ErrorService,
	) {}

	public async getBitcoinNetworkInfo(tag: string = 'GET { bitcoin_network_info }'): Promise<OrchardBitcoinNetworkInfo> {
		try {
			const [info, backend] = await Promise.all([this.bitcoinRpcService.getBitcoinNetworkInfo(), this.determineLightningBackend()]);
			return new OrchardBitcoinNetworkInfo(info, backend);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.BitcoinRPCError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Determines if this bitcoin node is the backend for the configured lightning node
	 * Checks lightning configuration, network match, and block height proximity
	 */
	private async determineLightningBackend(): Promise<boolean> {
		try {
			if (!this.lightningService.isConfigured()) return false;
			const [lightning_info, blockchain_info] = await Promise.all([
				this.lightningService.getLightningInfo(),
				this.bitcoinRpcService.getBitcoinBlockchainInfo(),
			]);
			const bitcoin_network = blockchain_info.chain;
			const lightning_network = lightning_info.chains?.[0]?.network;
			if (!this.networksMatch(bitcoin_network, lightning_network)) return false;
			const height_difference = Math.abs(blockchain_info.blocks - lightning_info.block_height);
			if (height_difference > 10) return false;
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Compares bitcoin and lightning network identifiers
	 * Bitcoin uses: "main", "test", "regtest", "signet"
	 * Lightning uses: "mainnet", "testnet", "signet", "bitcoin" (CLN)
	 */
	private networksMatch(bitcoin_network: string, lightning_network: string): boolean {
		const network_map: Record<string, string[]> = {
			main: ['mainnet', 'bitcoin'],
			test: ['testnet'],
			regtest: ['regtest'],
			signet: ['signet'],
		};
		return network_map[bitcoin_network]?.includes(lightning_network) ?? false;
	}
}
