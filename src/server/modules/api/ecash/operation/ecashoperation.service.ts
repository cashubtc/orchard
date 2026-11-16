/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletWatchService} from '#server/modules/cashu/wallet/watch/cashuwalletwatch.service';
import {CASHU_WALLET_FINAL_STATES} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {watchStream} from '#server/modules/graphql/graphql.helpers';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardCommonCount} from '#server/modules/api/common/entity-count.model';
import type {CashuWalletOperationFilters} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {OrchardEcashOperation} from './ecashoperation.model.js';
import type {EcashOperationWatchPayload} from './ecashoperation.types.js';

@Injectable()
export class EcashOperationService {
	private readonly logger = new Logger(EcashOperationService.name);

	constructor(
		private cashuWalletOperationService: CashuWalletOperationService,
		private cashuWalletIssueService: CashuWalletIssueService,
		private cashuWalletWatchService: CashuWalletWatchService,
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

	/** One of a user's wallet operations */
	async getEcashOperation(tag: string, user_id: string, operation_id: string): Promise<OrchardEcashOperation> {
		try {
			return new OrchardEcashOperation(await this.cashuWalletOperationService.getOperation(user_id, operation_id));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** The token one of a user's sends carries */
	async getEcashOperationToken(tag: string, user_id: string, operation_id: string): Promise<string> {
		try {
			return await this.cashuWalletOperationService.getToken(user_id, operation_id);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** A user's operation as it changes: its state now, then each update until it's final or the stream is returned */
	async watchEcashOperation(
		tag: string,
		user_id: string,
		operation_id: string,
		updates: AsyncIterableIterator<EcashOperationWatchPayload>,
	): Promise<AsyncIterableIterator<EcashOperationWatchPayload>> {
		const start = async () => {
			const {operation, release} = await this.cashuWalletWatchService.watch(user_id, operation_id);
			return {current: {ecash_operation_watch: new OrchardEcashOperation(operation)}, release};
		};
		const isFinal = (payload: EcashOperationWatchPayload) => CASHU_WALLET_FINAL_STATES.has(payload.ecash_operation_watch.state);
		try {
			return await watchStream(updates, start, isFinal);
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
