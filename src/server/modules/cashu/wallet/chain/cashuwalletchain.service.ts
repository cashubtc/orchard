/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import type {BitcoinRpcOptions} from '#server/modules/bitcoin/rpc/btcrpc.types';
/* Native Dependencies */
import {parseOutpoint} from '#server/modules/cashu/wallet/helpers/cashuwalletchain.helpers';

// A node that fails or stalls must not pass for an empty answer, nor hold up the wallet's checks
const STRICT: BitcoinRpcOptions = {strict: true, timeout_ms: 10_000};

/** Onchain progress the mint doesn't report yet, read from the operator's Bitcoin Core node; display only, the mint stays the authority */
@Injectable()
export class CashuWalletChainService {
	private readonly logger = new Logger(CashuWalletChainService.name);

	constructor(private bitcoinRpcService: BitcoinRpcService) {}

	/* *******************************************************
		Payments
	******************************************************** */

	/** Confirmations of an onchain payment's output, 0 while it's in the mempool; null without a node or once the node holds no such unspent output (spent, or on another chain), and `known` while the node can't be read */
	public async confirmations(outpoint: string, known: number | null): Promise<number | null> {
		const output = parseOutpoint(outpoint);
		if (!output || !this.bitcoinRpcService.isConfigured()) return null;
		try {
			const found = await this.bitcoinRpcService.getBitcoinTxOut(output.txid, output.vout, STRICT);
			return found?.confirmations ?? null;
		} catch (error) {
			this.logger.warn(`Confirmations of onchain payment ${outpoint} could not be read: ${error.message}`);
			return known;
		}
	}
}
