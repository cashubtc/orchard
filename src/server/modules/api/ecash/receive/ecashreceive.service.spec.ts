/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
import {WalletMintMatch} from '#server/modules/cashu/wallet/cashuwallet.enums';
/* Local Dependencies */
import {EcashReceiveService} from './ecashreceive.service.js';
import {OrchardEcashTokenPreview} from './ecashreceive.model.js';

describe('EcashReceiveService', () => {
	let ecashReceiveService: EcashReceiveService;
	let cashuWalletSwapService: jest.Mocked<CashuWalletSwapService>;
	let errorService: jest.Mocked<ErrorService>;

	const preview = {
		amount: 30,
		unit: 'sat',
		memo: 'Lunch',
		fee: 0,
		claimed: false,
		mint: {url: 'https://mint.example', info: null, latency_ms: null, time_offset: null, match: WalletMintMatch.URL, mint_id: 'mint-1'},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashReceiveService,
				{provide: CashuWalletSwapService, useValue: {previewToken: jest.fn(), receiveToken: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashReceiveService = module.get<EcashReceiveService>(EcashReceiveService);
		cashuWalletSwapService = module.get(CashuWalletSwapService);
		errorService = module.get(ErrorService);
	});

	it('previewToken maps the preview and the mint it is from', async () => {
		cashuWalletSwapService.previewToken.mockResolvedValue(preview);
		const result = await ecashReceiveService.previewToken('TAG', 'user-1', 'cashuBtoken', false);
		expect(cashuWalletSwapService.previewToken).toHaveBeenCalledWith('user-1', 'cashuBtoken', false);
		expect(result).toBeInstanceOf(OrchardEcashTokenPreview);
		expect(result).toMatchObject({amount: 30, fee: 0, claimed: false, mint: {url: 'https://mint.example', match: WalletMintMatch.URL}});
	});

	it('receiveToken passes the mint consent through', async () => {
		cashuWalletSwapService.receiveToken.mockResolvedValue({id: 'op-1', type: 'RECEIVE', state: 'FINALIZED', amount: 30} as any);
		const result = await ecashReceiveService.receiveToken('TAG', 'user-1', 'cashuBtoken', true, false);
		expect(cashuWalletSwapService.receiveToken).toHaveBeenCalledWith('user-1', 'cashuBtoken', true, false);
		expect(result).toBeInstanceOf(OrchardEcashOperation);
	});

	it('wraps failures as a wallet error', async () => {
		cashuWalletSwapService.receiveToken.mockRejectedValue(new Error('Token is not in wallet unit'));
		errorService.resolveError.mockImplementation((_logger, error) => error);
		await expect(ecashReceiveService.receiveToken('TAG', 'user-1', 'cashuBtoken', false, false)).rejects.toBeInstanceOf(
			OrchardApiError,
		);
		expect(errorService.resolveError).toHaveBeenCalledWith(
			expect.anything(),
			{code: OrchardErrorCode.EcashWalletError, details: 'Token is not in wallet unit'},
			'TAG',
			{errord: OrchardErrorCode.EcashWalletError},
		);
	});
});
