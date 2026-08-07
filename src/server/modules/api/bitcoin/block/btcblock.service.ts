/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {OrchardBitcoinBlock, OrchardBitcoinBlockTemplate} from './btcblock.model.js';

@Injectable()
export class BitcoinBlockService {
	private readonly logger = new Logger(BitcoinBlockService.name);

	constructor(
		private bitcoinRpcService: BitcoinRpcService,
		private errorService: ErrorService,
	) {}

	public async getBlock(tag: string = 'GET { bitcoin_block }', hash: string): Promise<OrchardBitcoinBlock> {
		try {
			const block = await this.bitcoinRpcService.getBitcoinBlock(hash);
			return new OrchardBitcoinBlock(block);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.BitcoinRPCError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	public async getBlockTemplate(tag: string): Promise<OrchardBitcoinBlockTemplate> {
		try {
			const block_template = await this.bitcoinRpcService.getBitcoinBlockTemplate();
			return new OrchardBitcoinBlockTemplate(block_template);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.BitcoinRPCError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	// startBlockCountPolling(interval_ms: number = 30000): void {
	// 	if (this.interval_id) this.stopBlockCountPolling();

	// 	this.interval_id = setInterval(async () => {
	// 		try {
	// 			const obbc = await this.getBlockCount();
	// 			if( obbc.height === this.block_count ) return;
	// 			this.block_count = obbc.height;
	// 			this.event_emitter.emit('bitcoin.blockcount.update', obbc.height);
	// 		} catch (error) {
	// 			this.stopBlockCountPolling();
	// 			throw error;
	// 		}
	// 	}, interval_ms);

	// 	this.logger.debug('Block count polling started');
	// }

	// stopBlockCountPolling(): void {
	// 	if ( !this.interval_id ) return;
	// 	clearInterval(this.interval_id);
	// 	this.interval_id = null;
	// 	this.logger.debug('Block count polling stopped');
	// }

	// onBlockCountUpdate(callback: (block_count: number) => void): void {
	// 	this.event_emitter.on('bitcoin.blockcount.update', callback);
	// }

	// onModuleDestroy() {
	// 	this.stopBlockCountPolling();
	// }
}
