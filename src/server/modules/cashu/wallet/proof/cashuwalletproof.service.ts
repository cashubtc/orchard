/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {In, Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {Amount, JSONInt, type Proof} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {WalletProofState} from '../cashuwallet.enums.js';
import type {CashuWalletOperation} from '../saga/cashuwalletoperation.entity.js';
import type {CashuWalletBalance} from '../cashuwallet.types.js';

/** Thrown inside a lock transaction to roll it back when another operation took one of the proofs first */
class InputsTakenError extends Error {}

@Injectable()
export class CashuWalletProofService {
	/** Selections in flight per wallet, mint and unit, so concurrent operations never pick the same proofs */
	private readonly selecting = new Map<string, Promise<unknown>>();

	constructor(
		@InjectRepository(CashuWalletProof)
		private walletProofRepository: Repository<CashuWalletProof>,
	) {}

	/* *******************************************************
		Balances
	******************************************************** */

	/** Sum a user's ready proofs by mint and unit */
	public async getBalances(user_id: string): Promise<CashuWalletBalance[]> {
		const rows = await this.walletProofRepository
			.createQueryBuilder('proof')
			.select('proof.mint_id', 'mint_id')
			.addSelect('proof.unit', 'unit')
			.addSelect('SUM(proof.amount)', 'balance')
			.where('proof.user_id = :user_id', {user_id})
			.andWhere('proof.state = :state', {state: WalletProofState.READY})
			.groupBy('proof.mint_id')
			.addGroupBy('proof.unit')
			.getRawMany<CashuWalletBalance>();
		return rows.map((row) => ({...row, balance: Number(row.balance)}));
	}

	/* *******************************************************
		Proofs
	******************************************************** */

	/** Store proofs an operation produced, ready to spend; a secret already stored is skipped */
	public async storeProofs(operation: CashuWalletOperation, proofs: Proof[]): Promise<void> {
		if (proofs.length === 0) return;
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
	}

	/* *******************************************************
		Inputs
	******************************************************** */

	/** Run a selection over a user's ready proofs at one mint and unit, one selection at a time per wallet, mint and unit */
	public withReadyProofs<T>(user_id: string, mint_id: string, unit: string, select: (ready: Proof[]) => Promise<T>): Promise<T> {
		const key = `${user_id}:${mint_id}:${unit}`;
		const previous = this.selecting.get(key) ?? Promise.resolve();
		const run = previous.catch(() => undefined).then(async () => select(await this.getReadyProofs(user_id, mint_id, unit)));
		const settled = run.catch(() => undefined);
		this.selecting.set(key, settled);
		void settled.then(() => {
			if (this.selecting.get(key) === settled) this.selecting.delete(key);
		});
		return run;
	}

	/** A user's ready proofs at a mint in one unit, as cashu-ts proofs */
	public async getReadyProofs(user_id: string, mint_id: string, unit: string): Promise<Proof[]> {
		const rows = await this.walletProofRepository.find({where: {user_id, mint_id, unit, state: WalletProofState.READY}});
		return rows.map((row) => ({
			id: row.keyset_id,
			amount: Amount.from(row.amount),
			secret: row.secret,
			C: row.c,
			...(row.dleq ? {dleq: JSONInt.parse(row.dleq) as Proof['dleq']} : {}),
		}));
	}

	/** Lock the proofs an operation spends as its inputs; all of them or none, false when another operation took one first */
	public async lockInputs(operation_id: string, proofs: Pick<Proof, 'secret'>[]): Promise<boolean> {
		const secrets = proofs.map((proof) => proof.secret);
		try {
			await this.walletProofRepository.manager.transaction(async (manager) => {
				const result = await manager.update(
					CashuWalletProof,
					{secret: In(secrets), state: WalletProofState.READY},
					{state: WalletProofState.INFLIGHT, used_by_op_id: operation_id, updated_at: DateTime.now().toUnixInteger()},
				);
				if (result.affected !== secrets.length) throw new InputsTakenError();
			});
			return true;
		} catch (error) {
			if (error instanceof InputsTakenError) return false;
			throw error;
		}
	}

	/** Mark an operation's inputs spent once the mint has taken them */
	public async spendInputs(operation_id: string): Promise<void> {
		await this.walletProofRepository.update(
			{used_by_op_id: operation_id, state: WalletProofState.INFLIGHT},
			{state: WalletProofState.SPENT, updated_at: DateTime.now().toUnixInteger()},
		);
	}

	/** Give an operation's inputs back to the wallet; only once the mint has confirmed they are unspent */
	public async releaseInputs(operation_id: string): Promise<void> {
		await this.walletProofRepository.update(
			{used_by_op_id: operation_id, state: WalletProofState.INFLIGHT},
			{state: WalletProofState.READY, used_by_op_id: null, updated_at: DateTime.now().toUnixInteger()},
		);
	}
}
