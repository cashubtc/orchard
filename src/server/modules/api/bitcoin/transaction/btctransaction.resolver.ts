/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args, Int} from '@nestjs/graphql';
/* Local Dependencies */
import {BtcTransactionService} from './btctransaction.service.js';
import {OrchardBitcoinTxFeeEstimate} from './btctransaction.model.js';

@Resolver()
export class BtcTransactionResolver {
	private readonly logger = new Logger(BtcTransactionResolver.name);

	constructor(private btcTransactionService: BtcTransactionService) {}

	@Query(() => [OrchardBitcoinTxFeeEstimate], {description: 'Get Bitcoin transaction fee estimates for confirmation targets'})
	async bitcoin_transaction_fee_estimates(
		@Args('targets', {type: () => [Int], description: 'Confirmation target block counts'}) targets: number[],
	): Promise<OrchardBitcoinTxFeeEstimate[]> {
		const tag = 'GET { bitcoin_transaction_fee_estimates }';
		this.logger.debug(tag);
		return await this.btcTransactionService.getTransactionFeeEstimates(tag, targets);
	}
}
