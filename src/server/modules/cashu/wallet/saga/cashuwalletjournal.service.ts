/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {Amount, JSONInt, OutputData, splitAmount, type Proof, type SerializedOutputData, type Wallet} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletCounter} from './cashuwalletcounter.entity.js';
import {CashuWalletProof} from '../proof/cashuwalletproof.entity.js';
import {CashuWalletSeedService} from '../seed/cashuwalletseed.service.js';
import {CashuWalletMintService} from '../mint/cashuwalletmint.service.js';
import {WalletOperationState, WalletProofState} from '../cashuwallet.enums.js';

@Injectable()
export class CashuWalletJournalService {
	constructor(
		@InjectRepository(CashuWalletOperation)
		private walletOperationRepository: Repository<CashuWalletOperation>,
		@InjectRepository(CashuWalletProof)
		private walletProofRepository: Repository<CashuWalletProof>,
		@InjectRepository(CashuWalletCounter)
		private walletCounterRepository: Repository<CashuWalletCounter>,
		private cashuWalletSeedService: CashuWalletSeedService,
		private cashuWalletMintService: CashuWalletMintService,
	) {}

	/* *******************************************************
		State
	******************************************************** */

	/** Move an operation to a new state if nobody else changed it first; otherwise return the current row */
	public async transition(
		operation: CashuWalletOperation,
		state: WalletOperationState,
		changes: Partial<CashuWalletOperation> = {},
	): Promise<CashuWalletOperation> {
		const next = {...changes, state, revision: operation.revision + 1, updated_at: DateTime.now().toUnixInteger()};
		const result = await this.walletOperationRepository.update({id: operation.id, revision: operation.revision}, next);
		if (result.affected) return {...operation, ...next};
		return this.walletOperationRepository.findOneByOrFail({id: operation.id});
	}

	/** Store the operation's proofs (idempotent by secret) and mark it finalized */
	public async finalize(operation: CashuWalletOperation, proofs: Proof[]): Promise<CashuWalletOperation> {
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

	/* *******************************************************
		Outputs
	******************************************************** */

	/** Deterministic (NUT-13) outputs for an amount on the wallet's keyset, on freshly reserved counters */
	public async createOutputs(user_id: string, wallet: Wallet, amount: number): Promise<OutputData[]> {
		const keyset = wallet.getKeyset();
		const split = splitAmount(amount, keyset.keys);
		const start = await this.reserveCounters(user_id, keyset.id, split.length);
		return OutputData.createDeterministicData(amount, await this.cashuWalletSeedService.getSeed(user_id), start, keyset, split);
	}

	/** Atomically claim the next n counters for a counter key; a crash can waste counters but never reuse them */
	public async reserveCounters(user_id: string, counter_key: string, count: number): Promise<number> {
		const rows: {next: number}[] = await this.walletCounterRepository.query(
			`INSERT INTO cashu_wallet_counters (user_id, counter_key, next, updated_at) VALUES (?, ?, ?, ?)
			ON CONFLICT(user_id, counter_key) DO UPDATE SET next = cashu_wallet_counters.next + excluded.next, updated_at = excluded.updated_at
			RETURNING next`,
			[user_id, counter_key, count, DateTime.now().toUnixInteger()],
		);
		return rows[0].next - count;
	}

	/** Outputs in cashu-ts storage form */
	public serializeOutputs(outputs: OutputData[]): string {
		return JSON.stringify(outputs.map((output) => OutputData.serialize(output)));
	}

	/** Outputs back from storage; cashu-ts validates each one on the way */
	public deserializeOutputs(stored: string | null): OutputData[] {
		return (JSON.parse(stored ?? '[]') as SerializedOutputData[]).map((output) => OutputData.deserialize(output));
	}

	/* *******************************************************
		Restore
	******************************************************** */

	/** NUT-09: rebuild proofs from the signatures the mint already issued on the saved outputs; none when it signed nothing */
	public async restore(operation: CashuWalletOperation, wallet: Wallet): Promise<Proof[]> {
		const outputs = this.deserializeOutputs(operation.outputs);
		const restored = await wallet.mint.restore({outputs: outputs.map((output) => output.blindedMessage)});
		if (restored.signatures.length === 0) return [];
		const signatures = new Map(restored.outputs.map((output, index) => [output.B_, restored.signatures[index]]));
		await wallet
			.ensureOperableKeysets(restored.signatures.map((signature) => signature.id))
			.finally(() => this.cashuWalletMintService.saveKeychain(wallet.keyChain.cache));
		const proofs = outputs.flatMap((output) => {
			const signature = signatures.get(output.blindedMessage.B_);
			if (!signature || !Amount.from(signature.amount).equals(output.blindedMessage.amount)) return [];
			return [output.toProof(signature, wallet.getKeyset(signature.id))];
		});
		if (proofs.length !== outputs.length) throw new Error(`Mint restored ${proofs.length} of ${outputs.length} outputs`);
		return proofs;
	}
}
