/* Core Dependencies */
import {Injectable, Logger, type OnApplicationBootstrap} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {
	Amount,
	JSONInt,
	OutputData,
	StaleKeysetError,
	splitAmount,
	type Proof,
	type SerializedOutputData,
	type Wallet,
} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {CashuWalletCounter} from './cashuwalletcounter.entity.js';
import {CashuWalletService} from './cashuwallet.service.js';
import {CashuWalletMintService} from './cashuwalletmint.service.js';
import {WalletErrorAction, WalletOperationState, WalletOperationType, WalletProofState} from './cashuwallet.enums.js';
import {classifyMintError, describeMintError} from './cashuwallet.helpers.js';
import type {CashuWalletMintRequest} from './cashuwallet.types.js';

@Injectable()
export class CashuWalletOperationService implements OnApplicationBootstrap {
	private readonly logger = new Logger(CashuWalletOperationService.name);

	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		@InjectRepository(CashuWalletProof)
		private walletProofRepository: Repository<CashuWalletProof>,
		@InjectRepository(CashuWalletCounter)
		private walletCounterRepository: Repository<CashuWalletCounter>,
		private cashuWalletService: CashuWalletService,
		private cashuWalletMintService: CashuWalletMintService,
	) {}

	/** Resume operations interrupted by a restart, without blocking startup */
	onApplicationBootstrap(): void {
		if (process.env.SCHEMA_ONLY) return;
		void this.recoverOperations();
	}

	/* *******************************************************
		Mint Operations
	******************************************************** */

	/** Journal a mint operation: reserve counters and persist its exact outputs before the mint is contacted */
	public async createMintOperation(request: CashuWalletMintRequest): Promise<CashuWalletOperation> {
		const wallet = await this.cashuWalletMintService.getWallet(request.mint_id, request.unit);
		const outputs = await this.createOutputs(request.user_id, wallet, request.amount);
		const now = DateTime.now().toUnixInteger();
		return this.walletOperationRepository.save(
			this.walletOperationRepository.create({
				...request,
				type: WalletOperationType.MINT,
				state: WalletOperationState.PENDING,
				outputs: this.serializeOutputs(outputs),
				created_at: now,
				updated_at: now,
			}),
		);
	}

	/** Mint an operation's saved outputs; safe to repeat, since the mint either signs them or they are restored */
	public async executeMintOperation(operation_id: string): Promise<CashuWalletOperation> {
		const operation = await this.walletOperationRepository.findOneByOrFail({id: operation_id});
		if (operation.state === WalletOperationState.FINALIZED || operation.state === WalletOperationState.FAILED) return operation;
		const executing =
			operation.state === WalletOperationState.PENDING ? await this.transition(operation, WalletOperationState.EXECUTING) : operation;
		return this.cashuWalletMintService.getWallet(executing.mint_id, executing.unit).then(
			(wallet) => this.attemptMint(executing, wallet, true),
			(error) => this.wait(executing, error),
		);
	}

	/** Re-run every operation left executing when the process stopped */
	public async recoverOperations(): Promise<void> {
		const interrupted = await this.walletOperationRepository.find({where: {state: WalletOperationState.EXECUTING}});
		for (const operation of interrupted) {
			const recovered = await this.executeMintOperation(operation.id);
			this.logger.log(`Wallet operation ${operation.id} resumed after restart: ${recovered.state}`);
		}
	}

	/* *******************************************************
		Execution
	******************************************************** */

	/** Send the saved outputs to the mint, applying the spec-driven action if it fails */
	private async attemptMint(operation: CashuWalletOperation, wallet: Wallet, allow_rebuild: boolean): Promise<CashuWalletOperation> {
		try {
			const outputs = this.deserializeOutputs(operation.outputs);
			const preview = await wallet.prepareMint(
				operation.method,
				operation.amount,
				{quote: operation.quote_id},
				{},
				{type: 'custom', data: outputs},
			);
			return await this.finalize(operation, await wallet.completeMint(preview));
		} catch (error) {
			return this.handleFailure(operation, wallet, error, allow_rebuild);
		}
	}

	/** Route a failed mint call to fail, restore, rebuild or wait */
	private handleFailure(
		operation: CashuWalletOperation,
		wallet: Wallet,
		error: unknown,
		allow_rebuild: boolean,
	): Promise<CashuWalletOperation> {
		const action = classifyMintError(error);
		if (action === WalletErrorAction.FAIL) {
			return this.transition(operation, WalletOperationState.FAILED, {error: describeMintError(error)});
		}
		if (action === WalletErrorAction.RESTORE) {
			return this.restore(operation, wallet).catch((restore_error) => this.wait(operation, restore_error));
		}
		if (action === WalletErrorAction.REBUILD && allow_rebuild) return this.rebuild(operation, wallet, error);
		return this.wait(operation, error);
	}

	/** NUT-09: rebuild proofs from the signatures the mint already issued on the saved outputs */
	private async restore(operation: CashuWalletOperation, wallet: Wallet): Promise<CashuWalletOperation> {
		const outputs = this.deserializeOutputs(operation.outputs);
		const restored = await wallet.mint.restore({outputs: outputs.map((output) => output.blindedMessage)});
		const signatures = new Map(restored.outputs.map((output, index) => [output.B_, restored.signatures[index]]));
		await wallet.ensureOperableKeysets(restored.signatures.map((signature) => signature.id));
		const proofs = outputs.flatMap((output) => {
			const signature = signatures.get(output.blindedMessage.B_);
			if (!signature || !Amount.from(signature.amount).equals(output.blindedMessage.amount)) return [];
			return [output.toProof(signature, wallet.getKeyset(signature.id))];
		});
		if (proofs.length !== outputs.length) throw new Error(`Mint restored ${proofs.length} of ${outputs.length} outputs`);
		return this.finalize(operation, proofs);
	}

	/** The mint signed nothing on a stale keyset: rebuild outputs on fresh counters and try once more */
	private async rebuild(operation: CashuWalletOperation, wallet: Wallet, error: unknown): Promise<CashuWalletOperation> {
		if (!(error instanceof StaleKeysetError && error.repaired)) await wallet.loadMint(true);
		const outputs = await this.createOutputs(operation.user_id, wallet, operation.amount);
		const rebuilt = await this.transition(operation, WalletOperationState.EXECUTING, {outputs: this.serializeOutputs(outputs)});
		return this.attemptMint(rebuilt, wallet, false);
	}

	/** Keep the operation executing with the failure recorded; recovery retries it */
	private wait(operation: CashuWalletOperation, error: unknown): Promise<CashuWalletOperation> {
		return this.transition(operation, WalletOperationState.EXECUTING, {error: describeMintError(error)});
	}

	/* *******************************************************
		Journal
	******************************************************** */

	/** Store the operation's proofs (idempotent by secret) and mark it finalized */
	private async finalize(operation: CashuWalletOperation, proofs: Proof[]): Promise<CashuWalletOperation> {
		const now = DateTime.now().toUnixInteger();
		await this.walletProofRepository
			.createQueryBuilder()
			.insert()
			.into(CashuWalletProof)
			.values(
				proofs.map((proof) => ({
					secret: proof.secret,
					user_id: operation.user_id,
					mint_id: operation.mint_id,
					keyset_id: proof.id,
					unit: operation.unit,
					amount: proof.amount.toNumber(),
					c: proof.C,
					dleq: proof.dleq ? JSONInt.stringify(proof.dleq) : null,
					state: WalletProofState.READY,
					created_by_op_id: operation.id,
					used_by_op_id: null,
					created_at: now,
					updated_at: now,
				})),
			)
			.orIgnore()
			.execute();
		return this.transition(operation, WalletOperationState.FINALIZED, {error: null});
	}

	/** Move an operation to a new state if nobody else changed it first; otherwise return the current row */
	private async transition(
		operation: CashuWalletOperation,
		state: WalletOperationState,
		changes: Partial<CashuWalletOperation> = {},
	): Promise<CashuWalletOperation> {
		const next = {...changes, state, revision: operation.revision + 1, updated_at: DateTime.now().toUnixInteger()};
		const result = await this.walletOperationRepository.update({id: operation.id, revision: operation.revision}, next);
		if (result.affected) return {...operation, ...next};
		return this.walletOperationRepository.findOneByOrFail({id: operation.id});
	}

	/* *******************************************************
		Outputs
	******************************************************** */

	/** Deterministic (NUT-13) outputs for an amount on the wallet's keyset, on freshly reserved counters */
	private async createOutputs(user_id: string, wallet: Wallet, amount: number): Promise<OutputData[]> {
		const keyset = wallet.getKeyset();
		const split = splitAmount(amount, keyset.keys);
		const start = await this.reserveCounters(user_id, keyset.id, split.length);
		return OutputData.createDeterministicData(amount, await this.cashuWalletService.getSeed(user_id), start, keyset, split);
	}

	/** Atomically claim the next n counters for a keyset; a crash can waste counters but never reuse them */
	private async reserveCounters(user_id: string, keyset_id: string, count: number): Promise<number> {
		const rows: {next: number}[] = await this.walletCounterRepository.query(
			`INSERT INTO cashu_wallet_counters (user_id, keyset_id, next, updated_at) VALUES (?, ?, ?, ?)
			ON CONFLICT(user_id, keyset_id) DO UPDATE SET next = cashu_wallet_counters.next + excluded.next, updated_at = excluded.updated_at
			RETURNING next`,
			[user_id, keyset_id, count, DateTime.now().toUnixInteger()],
		);
		return rows[0].next - count;
	}

	/** Outputs in cashu-ts storage form */
	private serializeOutputs(outputs: OutputData[]): string {
		return JSON.stringify(outputs.map((output) => OutputData.serialize(output)));
	}

	/** Outputs back from storage; cashu-ts validates each one on the way */
	private deserializeOutputs(stored: string | null): OutputData[] {
		return (JSON.parse(stored ?? '[]') as SerializedOutputData[]).map((output) => OutputData.deserialize(output));
	}
}
