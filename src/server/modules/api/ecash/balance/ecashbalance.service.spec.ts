/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuWalletService} from '#server/modules/cashu/wallet/cashuwallet.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {EcashBalanceService} from './ecashbalance.service.js';
import {OrchardEcashBalance} from './ecashbalance.model.js';

describe('EcashBalanceService', () => {
	let ecashBalanceService: EcashBalanceService;
	let cashuWalletService: jest.Mocked<CashuWalletService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashBalanceService,
				{provide: CashuWalletService, useValue: {getBalances: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashBalanceService = module.get<EcashBalanceService>(EcashBalanceService);
		cashuWalletService = module.get(CashuWalletService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(ecashBalanceService).toBeDefined();
	});

	it("getEcashBalances maps the user's balances to OrchardEcashBalance[]", async () => {
		cashuWalletService.getBalances.mockResolvedValue([{unit: 'sat', keyset_id: '00abc', balance: 1}]);
		const result = await ecashBalanceService.getEcashBalances('TAG', 'user-1');
		expect(cashuWalletService.getBalances).toHaveBeenCalledWith('user-1');
		expect(result[0]).toBeInstanceOf(OrchardEcashBalance);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		cashuWalletService.getBalances.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.EcashWalletError} as any);
		await expect(ecashBalanceService.getEcashBalances('TAG', 'user-1')).rejects.toBeInstanceOf(OrchardApiError);
		const call = errorService.resolveError.mock.calls[0];
		expect(call?.[3]).toEqual({errord: OrchardErrorCode.EcashWalletError});
	});
});
