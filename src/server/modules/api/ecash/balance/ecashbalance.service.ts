/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
/* Local Dependencies */
import {OrchardEcashBalance} from './ecashbalance.model.js';

@Injectable()
export class EcashBalanceService {
	private readonly logger = new Logger(EcashBalanceService.name);

	constructor(
		private cashuWalletProofService: CashuWalletProofService,
		private errorService: ErrorService,
	) {}

	/** Get a user's ecash wallet balances */
	async getEcashBalances(tag: string, user_id: string): Promise<OrchardEcashBalance[]> {
		try {
			const balances = await this.cashuWalletProofService.getBalances(user_id);
			return balances.map((balance) => new OrchardEcashBalance(balance));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
