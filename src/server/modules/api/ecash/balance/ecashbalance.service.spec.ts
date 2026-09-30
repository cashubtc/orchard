/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {EcashBalanceService} from './ecashbalance.service.js';
import {OrchardEcashBalance} from './ecashbalance.model.js';

describe('EcashBalanceService', () => {
	let ecashBalanceService: EcashBalanceService;
	let cashuWalletProofService: jest.Mocked<CashuWalletProofService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashBalanceService,
				{provide: CashuWalletProofService, useValue: {getBalances: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashBalanceService = module.get<EcashBalanceService>(EcashBalanceService);
		cashuWalletProofService = module.get(CashuWalletProofService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(ecashBalanceService).toBeDefined();
	});

	it("getEcashBalances maps the user's balances to OrchardEcashBalance[]", async () => {
		cashuWalletProofService.getBalances.mockResolvedValue([{mint_id: 'mint-1', unit: 'sat', balance: 1}]);
		const result = await ecashBalanceService.getEcashBalances('TAG', 'user-1');
		expect(cashuWalletProofService.getBalances).toHaveBeenCalledWith('user-1');
		expect(result[0]).toBeInstanceOf(OrchardEcashBalance);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		cashuWalletProofService.getBalances.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.EcashWalletError} as any);
		await expect(ecashBalanceService.getEcashBalances('TAG', 'user-1')).rejects.toBeInstanceOf(OrchardApiError);
		expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), expect.any(Error), 'TAG', {
			errord: OrchardErrorCode.EcashWalletError,
		});
	});
});
