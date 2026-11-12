/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {In} from 'typeorm';
/* Native Dependencies */
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
/* Local Dependencies */
import {CashuWalletRecoveryService} from './cashuwalletrecovery.service.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';

describe('CashuWalletRecoveryService', () => {
	let service: CashuWalletRecoveryService;

	const open = [
		{id: 'op-1', type: WalletOperationType.MINT, state: WalletOperationState.PENDING},
		{id: 'op-2', type: WalletOperationType.ISSUE, state: WalletOperationState.EXECUTING},
	];
	const operation_repository = {find: jest.fn()};
	const issue_service = {resume: jest.fn()};
	const swap_service = {resume: jest.fn(async (operation) => operation), checkClaims: jest.fn(async (operations) => operations)};

	beforeEach(async () => {
		jest.clearAllMocks();
		operation_repository.find.mockResolvedValue(open);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletRecoveryService,
				{provide: getRepositoryToken(CashuWalletOperation), useValue: operation_repository},
				{provide: CashuWalletIssueService, useValue: issue_service},
				{provide: CashuWalletSwapService, useValue: swap_service},
			],
		}).compile();

		service = module.get<CashuWalletRecoveryService>(CashuWalletRecoveryService);
	});

	it('resumes each open operation through its saga, oldest first', async () => {
		issue_service.resume.mockImplementation(async (operation) => ({...operation, state: WalletOperationState.FINALIZED}));
		await service.reconcileOperations();
		expect(operation_repository.find).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({type: In(Object.values(WalletOperationType))}),
				order: {created_at: 'ASC'},
			}),
		);
		expect(issue_service.resume.mock.calls.map(([operation]) => operation.id)).toEqual(['op-1', 'op-2']);
	});

	it('resumes executing swaps one by one, then checks unclaimed tokens together', async () => {
		const swaps = [
			{id: 'op-3', type: WalletOperationType.SEND, state: WalletOperationState.PENDING},
			{id: 'op-4', type: WalletOperationType.RECEIVE, state: WalletOperationState.EXECUTING},
			{id: 'op-5', type: WalletOperationType.SEND, state: WalletOperationState.EXECUTING},
			{id: 'op-6', type: WalletOperationType.SEND, state: WalletOperationState.PENDING},
		];
		operation_repository.find.mockResolvedValue(swaps);
		await service.reconcileOperations();
		expect(swap_service.resume.mock.calls.map(([operation]) => operation.id)).toEqual(['op-4', 'op-5']);
		expect(swap_service.checkClaims).toHaveBeenCalledTimes(1);
		expect(swap_service.checkClaims.mock.calls[0][0].map((operation: {id: string}) => operation.id)).toEqual(['op-3', 'op-6']);
		expect(issue_service.resume).not.toHaveBeenCalled();
	});

	it('keeps going when one operation cannot be resumed', async () => {
		issue_service.resume.mockRejectedValueOnce(new Error('database is locked')).mockResolvedValueOnce(open[1]);
		await expect(service.reconcileOperations()).resolves.toBeUndefined();
		expect(issue_service.resume).toHaveBeenCalledTimes(2);
	});

	it("settles only a user's open operations at one mint for a refresh, sharing a pass with refreshes alongside", async () => {
		issue_service.resume.mockImplementation(async (operation) => operation);
		const [first, second] = [service.reconcileMint('user-1', 'mint-1'), service.reconcileMint('user-1', 'mint-1')];
		expect(first).toBe(second);
		await first;
		expect(operation_repository.find).toHaveBeenCalledTimes(1);
		expect(operation_repository.find).toHaveBeenCalledWith(
			expect.objectContaining({where: expect.objectContaining({user_id: 'user-1', mint_id: 'mint-1'})}),
		);
		expect(issue_service.resume).toHaveBeenCalledTimes(2);
	});

	it('settles only the operations asked for, and nothing when none are', async () => {
		issue_service.resume.mockImplementation(async (operation) => operation);
		await service.settleOperations([]);
		expect(operation_repository.find).not.toHaveBeenCalled();

		await service.settleOperations(['op-1']);
		expect(operation_repository.find).toHaveBeenCalledWith(
			expect.objectContaining({where: expect.objectContaining({id: In(['op-1'])})}),
		);
	});

	it('runs one pass at a time', async () => {
		issue_service.resume.mockImplementation(async (operation) => operation);
		const [first, second] = [service.reconcileOperations(), service.reconcileOperations()];
		expect(first).toBe(second);
		await first;
		expect(operation_repository.find).toHaveBeenCalledTimes(1);
	});
});
