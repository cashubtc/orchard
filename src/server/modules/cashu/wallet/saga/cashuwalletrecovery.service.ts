/* Core Dependencies */
import {Injectable, Logger, type OnApplicationBootstrap} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {In, Repository, type FindOptionsWhere} from 'typeorm';
/* Native Dependencies */
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {describeMintError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
/* Local Dependencies */
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';

/** A sent token waiting to be claimed, checked in batches rather than resumed one by one */
const isUnclaimed = (operation: CashuWalletOperation): boolean =>
	operation.type === WalletOperationType.SEND && operation.state === WalletOperationState.PENDING;

@Injectable()
export class CashuWalletRecoveryService implements OnApplicationBootstrap {
	private readonly logger = new Logger(CashuWalletRecoveryService.name);
	/** Passes running now, by scope, so concurrent callers share one */
	private readonly reconciling = new Map<string, Promise<void>>();
	/** The saga that resumes each operation type; a Record, so a new type can't be left unreconciled */
	private readonly resumers: Record<WalletOperationType, (operation: CashuWalletOperation) => Promise<CashuWalletOperation>> = {
		[WalletOperationType.MINT]: (operation) => this.cashuWalletIssueService.resume(operation),
		[WalletOperationType.ISSUE]: (operation) => this.cashuWalletIssueService.resume(operation),
		[WalletOperationType.SEND]: (operation) => this.cashuWalletSwapService.resume(operation),
		[WalletOperationType.RECEIVE]: (operation) => this.cashuWalletSwapService.resume(operation),
	};

	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private cashuWalletIssueService: CashuWalletIssueService,
		private cashuWalletSwapService: CashuWalletSwapService,
	) {}

	/** Catch up on operations interrupted by a restart, without blocking startup */
	onApplicationBootstrap(): void {
		if (process.env.SCHEMA_ONLY) return;
		void this.reconcileOperations();
	}

	/* *******************************************************
		Reconciliation
	******************************************************** */

	/** Settle every open operation against its mint; concurrent callers share one pass */
	public reconcileOperations(): Promise<void> {
		return this.sharePass('all', {});
	}

	/** Settle a user's open operations at one mint now, for a refresh; concurrent refreshes share one pass */
	public reconcileMint(user_id: string, mint_id: string): Promise<void> {
		return this.sharePass(`${user_id}:${mint_id}`, {user_id, mint_id});
	}

	/** The pass running for a scope, or a new one */
	private sharePass(key: string, scope: FindOptionsWhere<CashuWalletOperation>): Promise<void> {
		const running = this.reconciling.get(key);
		if (running) return running;
		const pass = this.runReconciliation(scope).finally(() => this.reconciling.delete(key));
		this.reconciling.set(key, pass);
		return pass;
	}

	/** One pass over open operations: each resumed by its saga oldest first, then unclaimed tokens in one check per mint */
	private async runReconciliation(scope: FindOptionsWhere<CashuWalletOperation>): Promise<void> {
		const open_states = In([WalletOperationState.PENDING, WalletOperationState.EXECUTING]);
		const operations = await this.walletOperationRepository.find({
			where: {...scope, type: In(Object.keys(this.resumers)), state: open_states},
			order: {created_at: 'ASC'},
		});
		const settled: CashuWalletOperation[] = [];
		for (const operation of operations.filter((open) => !isUnclaimed(open))) {
			try {
				settled.push(await this.resumers[operation.type](operation));
			} catch (error) {
				this.logger.warn(`Wallet operation ${operation.id} could not be reconciled: ${describeMintError(error)}`);
			}
		}
		settled.push(...(await this.cashuWalletSwapService.checkClaims(operations.filter(isUnclaimed))));
		const finalized = settled.filter(({state}) => state === WalletOperationState.FINALIZED).length;
		const failed = settled.filter(({state}) => state === WalletOperationState.FAILED).length;
		if (finalized + failed === 0) return;
		this.logger.log(
			`Wallet reconciliation: ${finalized} finalized, ${failed} failed, ${operations.length - finalized - failed} still open`,
		);
	}
}
