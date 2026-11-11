/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {MintOperationError} from '@cashu/cashu-ts';
/* Application Dependencies */
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
/* Local Dependencies */
import {EcashSendService} from './ecashsend.service.js';

describe('EcashSendService', () => {
	let ecashSendService: EcashSendService;
	let cashuWalletSwapService: jest.Mocked<CashuWalletSwapService>;
	let errorService: jest.Mocked<ErrorService>;

	const operation: any = {
		id: 'op-1',
		mint_id: 'mint-1',
		type: 'SEND',
		state: 'PENDING',
		method: null,
		unit: 'sat',
		amount: 30,
		fee: 1,
		memo: 'Lunch',
		token: 'cashuBtoken',
		error: null,
		created_at: 1,
		updated_at: 2,
	};
	const request = {user_id: 'user-1', mint_id: 'mint-1', unit: 'sat', amount: 30, memo: 'Lunch'};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashSendService,
				{provide: CashuWalletSwapService, useValue: {sendToken: jest.fn(), checkToken: jest.fn(), reclaimToken: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashSendService = module.get<EcashSendService>(EcashSendService);
		cashuWalletSwapService = module.get(CashuWalletSwapService);
		errorService = module.get(ErrorService);
	});

	it('sendToken returns the operation without its token', async () => {
		cashuWalletSwapService.sendToken.mockResolvedValue(operation);
		const result = await ecashSendService.sendToken('TAG', request);
		expect(cashuWalletSwapService.sendToken).toHaveBeenCalledWith(request);
		expect(result).toBeInstanceOf(OrchardEcashOperation);
		expect(result).toMatchObject({fee: 1});
		expect(result).not.toHaveProperty('token');
	});

	it("checkToken and reclaimToken act on the user's send", async () => {
		cashuWalletSwapService.checkToken.mockResolvedValue({...operation, state: 'FINALIZED'});
		cashuWalletSwapService.reclaimToken.mockResolvedValue({...operation, state: 'RECLAIMED'});
		expect(await ecashSendService.checkToken('TAG', 'user-1', 'op-1')).toMatchObject({state: 'FINALIZED'});
		expect(await ecashSendService.reclaimToken('TAG', 'user-1', 'op-1')).toMatchObject({state: 'RECLAIMED'});
		expect(cashuWalletSwapService.reclaimToken).toHaveBeenCalledWith('user-1', 'op-1');
	});

	it('wraps a mint refusal as a wallet error, never under its NUT code', async () => {
		cashuWalletSwapService.sendToken.mockRejectedValue(new MintOperationError(11001, 'Token already spent'));
		errorService.resolveError.mockImplementation((_logger, error) => error);
		await expect(ecashSendService.sendToken('TAG', request)).rejects.toBeInstanceOf(OrchardApiError);
		expect(errorService.resolveError).toHaveBeenCalledWith(
			expect.anything(),
			{code: OrchardErrorCode.EcashWalletError, details: 'Mint error 11001: Token already spent'},
			'TAG',
			{errord: OrchardErrorCode.EcashWalletError},
		);
	});
});
