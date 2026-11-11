/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {DataSource, type Repository} from 'typeorm';
import {Amount} from '@cashu/cashu-ts';
/* Native Dependencies */
import {WalletProofState} from '#server/modules/cashu/wallet/cashuwallet.enums';
import type {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
/* Local Dependencies */
import {CashuWalletProofService} from './cashuwalletproof.service.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';

describe('CashuWalletProofService', () => {
	let service: CashuWalletProofService;

	const mock_query_builder: any = {
		select: jest.fn().mockReturnThis(),
		addSelect: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		groupBy: jest.fn().mockReturnThis(),
		addGroupBy: jest.fn().mockReturnThis(),
		getRawMany: jest.fn(),
	};
	const mock_proof_repository = {createQueryBuilder: jest.fn(() => mock_query_builder)};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [CashuWalletProofService, {provide: getRepositoryToken(CashuWalletProof), useValue: mock_proof_repository}],
		}).compile();

		service = module.get<CashuWalletProofService>(CashuWalletProofService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getBalances', () => {
		it("sums the user's ready proofs by mint and unit", async () => {
			mock_query_builder.getRawMany.mockResolvedValue([{mint_id: 'mint-1', unit: 'sat', balance: '42'}]);
			const balances = await service.getBalances('user-1');
			expect(mock_query_builder.where).toHaveBeenCalledWith('proof.user_id = :user_id', {user_id: 'user-1'});
			expect(mock_query_builder.andWhere).toHaveBeenCalledWith('proof.state = :state', {state: WalletProofState.READY});
			expect(balances).toEqual([{mint_id: 'mint-1', unit: 'sat', balance: 42}]);
		});
	});

	describe('inputs', () => {
		let data_source: DataSource;
		let proofs: Repository<CashuWalletProof>;

		const row = (secret: string, amount: number, state = WalletProofState.READY) => ({
			secret,
			user_id: 'user-1',
			mint_id: 'mint-1',
			keyset_id: '00abc',
			unit: 'sat',
			amount,
			c: '02c',
			state,
			created_at: 0,
			updated_at: 0,
		});
		const stateOf = async (secret: string) => (await proofs.findOneByOrFail({secret})).state;
		const lock = (operation_id: string, secrets: string[]) =>
			service.lockInputs(
				proofs.manager,
				operation_id,
				secrets.map((secret) => ({secret})),
			);

		beforeEach(async () => {
			data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities: [CashuWalletProof], synchronize: true});
			await data_source.initialize();
			proofs = data_source.getRepository(CashuWalletProof);
			const module: TestingModule = await Test.createTestingModule({
				providers: [CashuWalletProofService, {provide: getRepositoryToken(CashuWalletProof), useValue: proofs}],
			}).compile();
			service = module.get<CashuWalletProofService>(CashuWalletProofService);
			await proofs.save([row('a', 1), row('b', 2), row('spent', 4, WalletProofState.SPENT)]);
		});

		afterEach(async () => {
			await data_source.destroy();
		});

		it('lists ready proofs as cashu-ts proofs', async () => {
			const ready = await service.getReadyProofs('user-1', 'mint-1', 'sat');
			expect(ready.map((proof) => [proof.secret, proof.amount.toNumber(), proof.id, proof.C])).toEqual([
				['a', 1, '00abc', '02c'],
				['b', 2, '00abc', '02c'],
			]);
		});

		it('reports a lock another operation got to first, leaving the proof with it', async () => {
			expect(await lock('op-1', ['a'])).toBe(true);
			expect(await lock('op-2', ['a'])).toBe(false);
			expect(await proofs.findOneByOrFail({secret: 'a'})).toMatchObject({state: WalletProofState.INFLIGHT, used_by_op_id: 'op-1'});
		});

		it("spends or releases only an operation's own inputs", async () => {
			await lock('op-1', ['a']);
			await lock('op-2', ['b']);
			await service.spendInputs('op-1');
			await service.releaseInputs('op-2');
			expect(await stateOf('a')).toBe(WalletProofState.SPENT);
			expect(await proofs.findOneByOrFail({secret: 'b'})).toMatchObject({state: WalletProofState.READY, used_by_op_id: null});
		});

		it('marks inputs the mint reports spent as spent while releasing the rest', async () => {
			await lock('op-1', ['a', 'b']);
			await service.releaseInputs('op-1', ['a']);
			expect(await stateOf('a')).toBe(WalletProofState.SPENT);
			expect(await stateOf('b')).toBe(WalletProofState.READY);
		});

		it("holds a sent token's proofs out of the balance until they're spent, apart from its change", async () => {
			const operation = {id: 'op-1', user_id: 'user-1', mint_id: 'mint-1', unit: 'sat'} as CashuWalletOperation;
			const proof = (secret: string) => ({id: '00abc', amount: Amount.from(8), secret, C: '02c'});
			await service.storeProofs(operation, [proof('change')]);
			await service.storeProofs(operation, [proof('held')], WalletProofState.HELD);
			await lock('op-2', ['change']);
			expect((await service.getHeldProofs('op-1')).map((held) => held.secret)).toEqual(['held']);
			expect((await service.getReadyProofs('user-1', 'mint-1', 'sat')).map((ready) => ready.secret)).toEqual(['a', 'b']);

			await service.spendHeldProofs('op-1');
			expect(await stateOf('held')).toBe(WalletProofState.SPENT);
			expect(await stateOf('change')).toBe(WalletProofState.INFLIGHT);
		});

		it('runs one selection at a time per wallet, mint and unit, so a second sees what the first locked', async () => {
			const seen: string[][] = [];
			const select = (operation_id: string) =>
				service.withReadyProofs('user-1', 'mint-1', 'sat', async (ready) => {
					seen.push(ready.map((proof) => proof.secret));
					await lock(operation_id, [ready[0].secret]);
				});
			await Promise.all([select('op-1'), select('op-2')]);
			expect(seen).toEqual([['a', 'b'], ['b']]);
		});

		it('keeps selecting after one selection fails', async () => {
			await expect(
				service.withReadyProofs('user-1', 'mint-1', 'sat', async () => Promise.reject(new Error('mint down'))),
			).rejects.toThrow();
			expect(await service.withReadyProofs('user-1', 'mint-1', 'sat', async (ready) => ready.length)).toBe(2);
		});
	});
});
