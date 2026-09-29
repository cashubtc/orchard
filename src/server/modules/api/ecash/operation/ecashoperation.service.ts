/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/cashuwalletoperation.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
/* Local Dependencies */
import {OrchardEcashOperation} from './ecashoperation.model.js';

@Injectable()
export class EcashOperationService {
	private readonly logger = new Logger(EcashOperationService.name);

	constructor(
		private cashuWalletOperationService: CashuWalletOperationService,
		private errorService: ErrorService,
	) {}

	/** Issue ecash on the Orchard mint into a user's wallet */
	async issueEcash(tag: string, user_id: string, unit: string, amount: number, memo: string | null): Promise<OrchardEcashOperation> {
		try {
			const operation = await this.cashuWalletOperationService.issueEcash({user_id, unit, amount, memo});
			return new OrchardEcashOperation(operation);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
