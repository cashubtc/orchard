/* Core Dependencies */
import {Injectable, Logger, type OnApplicationBootstrap} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {In, Repository} from 'typeorm';
/* Local Dependencies */
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletIssueService} from './issue/cashuwalletissue.service.js';
import {WalletOperationState, WalletOperationType} from '../cashuwallet.enums.js';
import {describeMintError} from '../cashuwallet.helpers.js';

@Injectable()
export class CashuWalletRecoveryService implements OnApplicationBootstrap {
	private readonly logger = new Logger(CashuWalletRecoveryService.name);
	private reconciling: Promise<void> | null = null;

	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private cashuWalletIssueService: CashuWalletIssueService,
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
		this.reconciling ??= this.runReconciliation().finally(() => (this.reconciling = null));
		return this.reconciling;
	}

	/** One pass over open operations, oldest first, each resumed by its saga */
	private async runReconciliation(): Promise<void> {
		const open_states = In([WalletOperationState.PENDING, WalletOperationState.EXECUTING]);
		const operations = await this.walletOperationRepository.find({
			where: {type: WalletOperationType.MINT, state: open_states},
			order: {created_at: 'ASC'},
		});
		let finalized = 0;
		let failed = 0;
		for (const operation of operations) {
			try {
				const {state} = await this.cashuWalletIssueService.resume(operation);
				if (state === WalletOperationState.FINALIZED) finalized++;
				if (state === WalletOperationState.FAILED) failed++;
			} catch (error) {
				this.logger.warn(`Wallet operation ${operation.id} could not be reconciled: ${describeMintError(error)}`);
			}
		}
		if (finalized + failed === 0) return;
		this.logger.log(
			`Wallet reconciliation: ${finalized} finalized, ${failed} failed, ${operations.length - finalized - failed} still open`,
		);
	}
}
