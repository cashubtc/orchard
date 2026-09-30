/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Local Dependencies */
import {CashuWalletProofService} from './cashuwalletproof.service.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {WalletProofState} from '../cashuwallet.enums.js';

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
});
