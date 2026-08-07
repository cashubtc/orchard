/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {OrchardBitcoinTxFeeEstimate} from './btctransaction.model.js';

@Injectable()
export class BtcTransactionService {
	private readonly logger = new Logger(BtcTransactionService.name);

	constructor(
		private bitcoinRpcService: BitcoinRpcService,
		private errorService: ErrorService,
	) {}

	public async getTransactionFeeEstimates(tag: string, targets: number[]): Promise<OrchardBitcoinTxFeeEstimate[]> {
		try {
			const fee_estimates_promises = targets.map((target) =>
				this.bitcoinRpcService
					.getBitcoinFeeEstimate(target)
					.then((fee_estimate) => new OrchardBitcoinTxFeeEstimate(target, fee_estimate)),
			);
			return await Promise.all(fee_estimates_promises);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.BitcoinRPCError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
