/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/cashuwalletoperation.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {EcashOperationService} from './ecashoperation.service.js';
import {OrchardEcashOperation} from './ecashoperation.model.js';

describe('EcashOperationService', () => {
	let ecashOperationService: EcashOperationService;
	let cashuWalletOperationService: jest.Mocked<CashuWalletOperationService>;
	let errorService: jest.Mocked<ErrorService>;

	const operation: any = {
		id: 'op-1',
		user_id: 'user-1',
		mint_id: 'mint-1',
		type: 'MINT',
		state: 'FINALIZED',
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
				{provide: CashuWalletOperationService, useValue: {issueEcash: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashOperationService = module.get<EcashOperationService>(EcashOperationService);
		cashuWalletOperationService = module.get(CashuWalletOperationService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(ecashOperationService).toBeDefined();
	});

	it('issueEcash returns the operation without its internals', async () => {
		cashuWalletOperationService.issueEcash.mockResolvedValue(operation);
		const result = await ecashOperationService.issueEcash('TAG', 'user-1', 'sat', 100, 'Giveaway');
		expect(cashuWalletOperationService.issueEcash).toHaveBeenCalledWith({
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
		cashuWalletOperationService.issueEcash.mockRejectedValue(wallet_error);
		errorService.resolveError.mockReturnValue(wallet_error);
		await expect(ecashOperationService.issueEcash('TAG', 'user-1', 'sat', 1, null)).rejects.toBeInstanceOf(OrchardApiError);
	});
});
