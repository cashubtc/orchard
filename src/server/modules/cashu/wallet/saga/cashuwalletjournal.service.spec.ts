/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {Amount, type Proof} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuWalletJournalService} from './cashuwalletjournal.service.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletCounter} from './cashuwalletcounter.entity.js';
import {CashuWalletProof} from '../proof/cashuwalletproof.entity.js';
import {CashuWalletSeedService} from '../seed/cashuwalletseed.service.js';
import {CashuWalletMintService} from '../mint/cashuwalletmint.service.js';
import {WalletOperationState, WalletOperationType} from '../cashuwallet.enums.js';

describe('CashuWalletJournalService', () => {
	let service: CashuWalletJournalService;
	let data_source: DataSource;

	const entities = [CashuWalletOperation, CashuWalletCounter, CashuWalletProof];
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
				{provide: CashuWalletSeedService, useValue: {getSeed: jest.fn()}},
				{provide: CashuWalletMintService, useValue: {saveKeychain: jest.fn()}},
				...entities.map((entity) => ({provide: getRepositoryToken(entity), useValue: data_source.getRepository(entity)})),
			],
		}).compile();
		service = module.get<CashuWalletJournalService>(CashuWalletJournalService);
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	it('reserves counter ranges that never overlap, per counter key', async () => {
		expect(await service.reserveCounters('user-1', 'keyset-a', 3)).toBe(0);
		expect(await service.reserveCounters('user-1', 'keyset-a', 2)).toBe(3);
		expect(await service.reserveCounters('user-1', 'keyset-b', 1)).toBe(0);
		expect(await service.reserveCounters('user-2', 'keyset-a', 1)).toBe(0);
	});

	it('changes state only from the revision it read, returning the current row otherwise', async () => {
		const operation = await createOperation();
		const executing = await service.transition(operation, WalletOperationState.EXECUTING);
		expect(executing).toMatchObject({state: WalletOperationState.EXECUTING, revision: 1});

		const stale = await service.transition(operation, WalletOperationState.FAILED, {error: 'late'});
		expect(stale).toMatchObject({state: WalletOperationState.EXECUTING, revision: 1, error: null});
	});

	it('stores proofs once by secret and finalizes the operation', async () => {
		const operation = await createOperation();
		const proofs = [proof('secret-1', 1), proof('secret-2', 2)];
		const finalized = await service.finalize(operation, proofs);
		await service.finalize(finalized, proofs);
		expect(finalized).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
		expect(await data_source.getRepository(CashuWalletProof).count()).toBe(2);
	});
});
