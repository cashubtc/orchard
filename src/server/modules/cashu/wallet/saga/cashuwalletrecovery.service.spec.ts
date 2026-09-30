/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Local Dependencies */
import {CashuWalletRecoveryService} from './cashuwalletrecovery.service.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletIssueService} from './issue/cashuwalletissue.service.js';
import {WalletOperationState, WalletOperationType} from '../cashuwallet.enums.js';

describe('CashuWalletRecoveryService', () => {
	let service: CashuWalletRecoveryService;

	const open = [
		{id: 'op-1', state: WalletOperationState.PENDING},
		{id: 'op-2', state: WalletOperationState.EXECUTING},
	];
	const operation_repository = {find: jest.fn()};
	const issue_service = {resume: jest.fn()};

	beforeEach(async () => {
		jest.clearAllMocks();
		operation_repository.find.mockResolvedValue(open);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletRecoveryService,
				{provide: getRepositoryToken(CashuWalletOperation), useValue: operation_repository},
				{provide: CashuWalletIssueService, useValue: issue_service},
			],
		}).compile();

		service = module.get<CashuWalletRecoveryService>(CashuWalletRecoveryService);
	});

	it('resumes each open mint operation through the issue saga, oldest first', async () => {
		issue_service.resume.mockImplementation(async (operation) => ({...operation, state: WalletOperationState.FINALIZED}));
		await service.reconcileOperations();
		expect(operation_repository.find).toHaveBeenCalledWith(
			expect.objectContaining({where: expect.objectContaining({type: WalletOperationType.MINT}), order: {created_at: 'ASC'}}),
		);
		expect(issue_service.resume.mock.calls.map(([operation]) => operation.id)).toEqual(['op-1', 'op-2']);
	});

	it('keeps going when one operation cannot be resumed', async () => {
		issue_service.resume.mockRejectedValueOnce(new Error('database is locked')).mockResolvedValueOnce(open[1]);
		await expect(service.reconcileOperations()).resolves.toBeUndefined();
		expect(issue_service.resume).toHaveBeenCalledTimes(2);
	});

	it('runs one pass at a time', async () => {
		issue_service.resume.mockImplementation(async (operation) => operation);
		const [first, second] = [service.reconcileOperations(), service.reconcileOperations()];
		expect(first).toBe(second);
		await first;
		expect(operation_repository.find).toHaveBeenCalledTimes(1);
	});
});
