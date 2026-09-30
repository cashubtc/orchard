/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {OrchardCommonCount} from '#server/modules/api/common/entity-count.model';
import {WalletOperationState} from '#server/modules/cashu/wallet/cashuwallet.enums';
/* Local Dependencies */
import {EcashOperationService} from './ecashoperation.service.js';
import {OrchardEcashOperation} from './ecashoperation.model.js';

describe('EcashOperationService', () => {
	let ecashOperationService: EcashOperationService;
	let cashuWalletOperationService: jest.Mocked<CashuWalletOperationService>;
	let cashuWalletIssueService: jest.Mocked<CashuWalletIssueService>;
	let errorService: jest.Mocked<ErrorService>;

	const operation: any = {
		id: 'op-1',
		user_id: 'user-1',
		mint_id: 'mint-1',
		type: 'MINT',
		state: 'FINALIZED',
		method: 'bolt11',
		unit: 'sat',
		amount: 100,
		memo: 'Giveaway',
		error: null,
		quote_counter: 0,
		created_at: 1,
		updated_at: 2,
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashOperationService,
				{provide: CashuWalletOperationService, useValue: {listOperations: jest.fn(), countOperations: jest.fn()}},
				{provide: CashuWalletIssueService, useValue: {issueEcash: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashOperationService = module.get<EcashOperationService>(EcashOperationService);
		cashuWalletOperationService = module.get(CashuWalletOperationService);
		cashuWalletIssueService = module.get(CashuWalletIssueService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(ecashOperationService).toBeDefined();
	});

	it('getEcashOperations passes the filters through and maps each operation', async () => {
		cashuWalletOperationService.listOperations.mockResolvedValue([operation]);
		const filters = {states: [WalletOperationState.FINALIZED], page: 0, page_size: 5};
		const [result] = await ecashOperationService.getEcashOperations('TAG', 'user-1', filters);
		expect(cashuWalletOperationService.listOperations).toHaveBeenCalledWith('user-1', filters);
		expect(result).toBeInstanceOf(OrchardEcashOperation);
		expect(result.method).toBe('bolt11');
	});

	it('getEcashOperationCount wraps the count', async () => {
		cashuWalletOperationService.countOperations.mockResolvedValue(7);
		await expect(ecashOperationService.getEcashOperationCount('TAG', 'user-1', {})).resolves.toEqual(new OrchardCommonCount(7));
	});

	it('issueEcash returns the operation without its internals', async () => {
		cashuWalletIssueService.issueEcash.mockResolvedValue(operation);
		const result = await ecashOperationService.issueEcash('TAG', 'user-1', 'sat', 100, 'Giveaway');
		expect(cashuWalletIssueService.issueEcash).toHaveBeenCalledWith({
			user_id: 'user-1',
			unit: 'sat',
			amount: 100,
			memo: 'Giveaway',
		});
		expect(result).toBeInstanceOf(OrchardEcashOperation);
		expect(result).not.toHaveProperty('quote_counter');
	});

	it('wraps issue errors as OrchardApiError', async () => {
		const wallet_error = {code: OrchardErrorCode.EcashWalletError, details: 'Mint error 11006: Amount out of limit range'};
		cashuWalletIssueService.issueEcash.mockRejectedValue(wallet_error);
		errorService.resolveError.mockReturnValue(wallet_error);
		await expect(ecashOperationService.issueEcash('TAG', 'user-1', 'sat', 1, null)).rejects.toBeInstanceOf(OrchardApiError);
	});
});
