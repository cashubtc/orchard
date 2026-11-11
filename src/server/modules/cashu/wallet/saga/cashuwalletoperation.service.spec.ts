/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
/* Native Dependencies */
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import type {CashuWalletOperationFilters} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {CashuWalletOperationService} from './cashuwalletoperation.service.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';

describe('CashuWalletOperationService', () => {
	let service: CashuWalletOperationService;
	let data_source: DataSource;

	const ids = async (filters?: CashuWalletOperationFilters) =>
		(await service.listOperations('user-1', filters)).map((operation) => operation.id);
	const seedOperations = () =>
		data_source.getRepository(CashuWalletOperation).save(
			[
				{user_id: 'user-1', state: WalletOperationState.FINALIZED, created_at: 100},
				{user_id: 'user-1', state: WalletOperationState.FAILED, created_at: 200},
				{user_id: 'user-1', state: WalletOperationState.PENDING, created_at: 300},
				{user_id: 'user-2', state: WalletOperationState.FINALIZED, created_at: 400},
			].map((row) => ({
				...row,
				mint_id: 'mint-1',
				method: 'bolt11',
				type: WalletOperationType.MINT,
				unit: 'sat',
				amount: 100,
				updated_at: 0,
			})),
		);

	beforeEach(async () => {
		data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities: [CashuWalletOperation], synchronize: true});
		await data_source.initialize();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletOperationService,
				{provide: getRepositoryToken(CashuWalletOperation), useValue: data_source.getRepository(CashuWalletOperation)},
			],
		}).compile();
		service = module.get<CashuWalletOperationService>(CashuWalletOperationService);
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	it("lists a user's operations newest first, never another user's", async () => {
		const [first, second, third] = await seedOperations();
		expect(await ids()).toEqual([third.id, second.id, first.id]);
	});

	it('filters by state and date range, and counts without paging', async () => {
		const [first, second] = await seedOperations();
		const filters = {states: [WalletOperationState.FINALIZED, WalletOperationState.FAILED], date_start: 50, date_end: 250};
		expect(await ids(filters)).toEqual([second.id, first.id]);
		expect(await ids({...filters, page: 1, page_size: 1})).toEqual([first.id]);
		expect(await service.countOperations('user-1', {...filters, page: 1, page_size: 1})).toBe(2);
	});

	it("gets one of a user's operations, never another user's", async () => {
		const [first, , , other] = await seedOperations();
		expect(await service.getOperation('user-1', first.id)).toMatchObject({id: first.id});
		await expect(service.getOperation('user-1', other.id)).rejects.toEqual(walletError('Operation not found'));
	});

	it('returns the token a send carries, refusing operations without one', async () => {
		const [first, second] = await seedOperations();
		await data_source
			.getRepository(CashuWalletOperation)
			.update({id: first.id}, {type: WalletOperationType.SEND, token: 'cashuBtoken'});
		expect(await service.getToken('user-1', first.id)).toBe('cashuBtoken');
		await expect(service.getToken('user-1', second.id)).rejects.toEqual(walletError('This operation has no token'));
	});

	it('filters by unit, mint, method and type', async () => {
		await seedOperations();
		const filters = {units: ['sat'], mint_ids: ['mint-1'], methods: ['bolt11'], types: [WalletOperationType.MINT]};
		expect(await service.countOperations('user-1', filters)).toBe(3);
		expect(await service.countOperations('user-1', {methods: ['bolt12']})).toBe(0);
	});
});
