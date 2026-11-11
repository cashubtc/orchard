/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {Amount, type Proof, type Wallet} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuWalletJournalService} from './cashuwalletjournal.service.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletProof} from '../proof/cashuwalletproof.entity.js';
import {CashuWalletProofService} from '../proof/cashuwalletproof.service.js';
import {WalletOperationState, WalletOperationType, WalletProofState} from '../cashuwallet.enums.js';

describe('CashuWalletJournalService', () => {
	let service: CashuWalletJournalService;
	let data_source: DataSource;

	const entities = [CashuWalletOperation, CashuWalletProof];
	const createOperation = () =>
		data_source.getRepository(CashuWalletOperation).save({
			user_id: 'user-1',
			mint_id: 'mint-1',
			method: 'bolt11',
			type: WalletOperationType.MINT,
			state: WalletOperationState.PENDING,
			unit: 'sat',
			amount: 3,
			created_at: 0,
			updated_at: 0,
		});
	const proof = (secret: string, amount: number) => ({id: '00abc', amount: Amount.from(amount), secret, C: '02c'}) as Proof;

	beforeEach(async () => {
		data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities, synchronize: true});
		await data_source.initialize();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletJournalService,
				CashuWalletProofService,
				...entities.map((entity) => ({provide: getRepositoryToken(entity), useValue: data_source.getRepository(entity)})),
			],
		}).compile();
		service = module.get<CashuWalletJournalService>(CashuWalletJournalService);
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	it('changes state only from the revision it read, returning the current row otherwise', async () => {
		const operation = await createOperation();
		const executing = await service.transition(operation, WalletOperationState.EXECUTING);
		expect(executing).toMatchObject({state: WalletOperationState.EXECUTING, revision: 1});

		const stale = await service.transition(operation, WalletOperationState.FAILED, {error: 'late'});
		expect(stale).toMatchObject({state: WalletOperationState.EXECUTING, revision: 1, error: null});
	});

	it('journals an operation together with locking its inputs, or neither when one is taken', async () => {
		const proofs = data_source.getRepository(CashuWalletProof);
		const ready = {user_id: 'user-1', mint_id: 'mint-1', keyset_id: '00abc', unit: 'sat', c: '02c', created_at: 0, updated_at: 0};
		await proofs.save([
			{...ready, secret: 'a', amount: 1, state: WalletProofState.READY},
			{...ready, secret: 'b', amount: 2, state: WalletProofState.READY},
		]);
		const draft = () =>
			data_source.getRepository(CashuWalletOperation).create({
				user_id: 'user-1',
				mint_id: 'mint-1',
				type: WalletOperationType.SEND,
				state: WalletOperationState.EXECUTING,
				unit: 'sat',
				amount: 1,
				created_at: 0,
				updated_at: 0,
			});

		const opened = await service.open(draft(), [{secret: 'a'}]);
		expect(await proofs.findOneByOrFail({secret: 'a'})).toMatchObject({state: WalletProofState.INFLIGHT, used_by_op_id: opened.id});

		await expect(service.open(draft(), [{secret: 'a'}, {secret: 'b'}])).rejects.toMatchObject({
			details: 'Another payment is using this ecash right now; try again',
		});
		expect(await data_source.getRepository(CashuWalletOperation).count()).toBe(1);
		expect(await proofs.findOneByOrFail({secret: 'b'})).toMatchObject({state: WalletProofState.READY});
	});

	it('stores proofs once by secret and finalizes the operation', async () => {
		const operation = await createOperation();
		const proofs = [proof('secret-1', 1), proof('secret-2', 2)];
		const finalized = await service.finalize(operation, proofs);
		await service.finalize(finalized, proofs);
		expect(finalized).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
		expect(await data_source.getRepository(CashuWalletProof).count()).toBe(2);
	});

	it('spends the inputs an operation holds when it finalizes', async () => {
		const operation = await createOperation();
		const proofs = data_source.getRepository(CashuWalletProof);
		const input = {
			user_id: 'user-1',
			mint_id: 'mint-1',
			keyset_id: '00abc',
			unit: 'sat',
			amount: 4,
			c: '02c',
			created_at: 0,
			updated_at: 0,
		};
		await proofs.save([
			{...input, secret: 'input', state: WalletProofState.INFLIGHT, used_by_op_id: operation.id},
			{...input, secret: 'other', state: WalletProofState.INFLIGHT, used_by_op_id: 'op-other'},
		]);
		await service.finalize(operation, [proof('change', 1)]);
		expect(await proofs.findOneByOrFail({secret: 'input'})).toMatchObject({state: WalletProofState.SPENT});
		expect(await proofs.findOneByOrFail({secret: 'other'})).toMatchObject({state: WalletProofState.INFLIGHT});
		expect(await proofs.findOneByOrFail({secret: 'change'})).toMatchObject({
			state: WalletProofState.READY,
			created_by_op_id: operation.id,
		});
	});

	describe('restore', () => {
		const counters = JSON.stringify([{keysetId: '00abc', start: 4, count: 2, next: 6}]);
		const restoring = (proofs: Proof[]) => ({restore: jest.fn(async () => ({proofs}))}) as unknown as Wallet;

		it("restores the operation's counter range", async () => {
			const operation = {...(await createOperation()), counters};
			const wallet = restoring([proof('first', 1), proof('second', 2)]);
			expect((await service.restore(operation, wallet)).map((restored) => restored.secret)).toEqual(['first', 'second']);
			expect(wallet.restore).toHaveBeenCalledWith(4, 2, {keysetId: '00abc'});
		});

		it('refuses a partial restore unless the range may be part signed', async () => {
			const operation = {...(await createOperation()), counters};
			const wallet = restoring([proof('new', 2)]);
			await expect(service.restore(operation, wallet)).rejects.toThrow('Mint restored 1 of 2 outputs');
			expect(await service.restore(operation, wallet, true)).toHaveLength(1);
		});
	});
});
