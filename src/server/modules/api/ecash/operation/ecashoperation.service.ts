/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletWatchService} from '#server/modules/cashu/wallet/watch/cashuwalletwatch.service';
import {CASHU_WALLET_FINAL_STATES} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
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
		const pending = updates.next();
		try {
			const {operation, release} = await this.cashuWalletWatchService.watch(user_id, operation_id);
			return this.watchStream(updates, pending, {ecash_operation_watch: new OrchardEcashOperation(operation)}, release);
		} catch (error) {
			await updates.return?.();
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** The current state first, then each update; a final state or returning the stream releases the watch at once, even mid-wait */
	private watchStream(
		updates: AsyncIterableIterator<EcashOperationWatchPayload>,
		pending: Promise<IteratorResult<EcashOperationWatchPayload>>,
		current: EcashOperationWatchPayload,
		release: () => void,
	): AsyncIterableIterator<EcashOperationWatchPayload> {
		const queue: Promise<IteratorResult<EcashOperationWatchPayload>>[] = [Promise.resolve({done: false, value: current}), pending];
		let finished = false;
		const finish = async (): Promise<IteratorResult<EcashOperationWatchPayload>> => {
			if (!finished) {
				finished = true;
				release();
				await updates.return?.();
			}
			return {done: true, value: undefined};
		};
		const stream: AsyncIterableIterator<EcashOperationWatchPayload> = {
			next: async () => {
				if (finished) return {done: true, value: undefined};
				const result = await (queue.shift() ?? updates.next());
				if (result.done || CASHU_WALLET_FINAL_STATES.has(result.value.ecash_operation_watch.state)) await finish();
				return result;
			},
			return: finish,
			[Symbol.asyncIterator]: () => stream,
		};
		return stream;
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
