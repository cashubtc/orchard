/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EventEmitter2} from '@nestjs/event-emitter';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {OutputData, type OperationCounters, type OutputDataLike, type Proof, type SerializedOutputData, type Wallet} from '@cashu/cashu-ts';
/* Native Dependencies */
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {WalletOperationState} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {CASHU_WALLET_OPERATION_UPDATED} from '#server/modules/cashu/wallet/constants/cashuwallet.constants';
/* Local Dependencies */
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';

@Injectable()
export class CashuWalletJournalService {
	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		private cashuWalletProofService: CashuWalletProofService,
		private eventEmitter: EventEmitter2,
	) {}

	/* *******************************************************
		State
	******************************************************** */

	/** Journal a new operation and lock the proofs it spends together, refusing when another operation took one of them first */
	public open(operation: CashuWalletOperation, inputs: Pick<Proof, 'secret'>[]): Promise<CashuWalletOperation> {
		return this.walletOperationRepository.manager.transaction(async (manager) => {
			const saved = await manager.save(operation);
			if (!(await this.cashuWalletProofService.lockInputs(manager, saved.id, inputs))) {
				throw walletError('Another payment is using this ecash right now; try again');
			}
			return saved;
		});
	}

	/** Move an operation to a new state if nobody else changed it first, announcing the change without its ecash; a stale operation gets the current row, a no-op itself */
	public async transition(
		operation: CashuWalletOperation,
		state: WalletOperationState,
		changes: Partial<CashuWalletOperation> = {},
	): Promise<CashuWalletOperation> {
		const unchanged =
			operation.state === state &&
			Object.entries(changes).every(([field, value]) => operation[field as keyof CashuWalletOperation] === value);
		if (unchanged) return operation;
		const next = {...changes, state, revision: operation.revision + 1, updated_at: DateTime.now().toUnixInteger()};
		const result = await this.walletOperationRepository.update({id: operation.id, revision: operation.revision}, next);
		if (!result.affected) return this.walletOperationRepository.findOneByOrFail({id: operation.id});
		const transitioned = {...operation, ...next};
		const {token, preview, inputs, ...update} = transitioned;
		this.eventEmitter.emit(CASHU_WALLET_OPERATION_UPDATED, update);
		return transitioned;
	}

	/** Store the operation's new proofs (idempotent by secret), spend its inputs and mark it finalized */
	public async finalize(operation: CashuWalletOperation, proofs: Proof[]): Promise<CashuWalletOperation> {
		await this.cashuWalletProofService.storeProofs(operation, proofs);
		await this.cashuWalletProofService.spendInputs(operation.id);
		return this.transition(operation, WalletOperationState.FINALIZED, {error: null});
	}

	/* *******************************************************
		Outputs
	******************************************************** */

	/** Outputs in cashu-ts storage form */
	public serializeOutputs(outputs: OutputDataLike[]): string {
		return JSON.stringify(outputs.map((output) => OutputData.serialize(output)));
	}

	/** Outputs back from storage; cashu-ts validates each one on the way */
	public deserializeOutputs(stored: string | null): OutputData[] {
		return (JSON.parse(stored ?? '[]') as SerializedOutputData[]).map((output) => OutputData.deserialize(output));
	}

	/* *******************************************************
		Restore
	******************************************************** */

	/** NUT-09: proofs the mint already signed on an operation's counters; none when it signed nothing, and `partial` allows a range it only part signed, like melt change */
	public async restore(operation: CashuWalletOperation, wallet: Wallet, partial = false): Promise<Proof[]> {
		const ranges = JSON.parse(operation.counters ?? '[]') as OperationCounters[];
		const proofs = (
			await Promise.all(ranges.map((range) => wallet.restore(range.start, range.count, {keysetId: range.keysetId})))
		).flatMap((result) => result.proofs);
		const expected = ranges.reduce((sum, range) => sum + range.count, 0);
		if (!partial && proofs.length > 0 && proofs.length !== expected) {
			throw new Error(`Mint restored ${proofs.length} of ${expected} outputs`);
		}
		return proofs;
	}
}
