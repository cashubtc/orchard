/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardCommonCount} from '#server/modules/api/common/entity-count.model';
import type {CashuWalletOperationFilters} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {OrchardEcashOperation} from './ecashoperation.model.js';

@Injectable()
export class EcashOperationService {
	private readonly logger = new Logger(EcashOperationService.name);

	constructor(
		private cashuWalletOperationService: CashuWalletOperationService,
		private cashuWalletIssueService: CashuWalletIssueService,
		private errorService: ErrorService,
	) {}

	/** A user's wallet operations matching the filters, newest first */
	async getEcashOperations(tag: string, user_id: string, filters: CashuWalletOperationFilters): Promise<OrchardEcashOperation[]> {
		try {
			const operations = await this.cashuWalletOperationService.listOperations(user_id, filters);
			return operations.map((operation) => new OrchardEcashOperation(operation));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Number of a user's wallet operations matching the filters */
	async getEcashOperationCount(tag: string, user_id: string, filters: CashuWalletOperationFilters): Promise<OrchardCommonCount> {
		try {
			return new OrchardCommonCount(await this.cashuWalletOperationService.countOperations(user_id, filters));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Issue ecash on the Orchard mint into a user's wallet */
	async issueEcash(tag: string, user_id: string, unit: string, amount: number, memo: string | null): Promise<OrchardEcashOperation> {
		try {
			const operation = await this.cashuWalletIssueService.issueEcash({user_id, unit, amount, memo});
			return new OrchardEcashOperation(operation);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
