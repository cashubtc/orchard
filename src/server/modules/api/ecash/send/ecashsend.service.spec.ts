/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {MintOperationError} from '@cashu/cashu-ts';
/* Application Dependencies */
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {CashuWalletMeltService} from '#server/modules/cashu/wallet/saga/melt/cashuwalletmelt.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
/* Local Dependencies */
import {EcashSendService} from './ecashsend.service.js';
import {OrchardEcashMeltQuote, OrchardEcashMeltQuoteFee, OrchardEcashSendTokenPreview} from './ecashsend.model.js';

describe('EcashSendService', () => {
	let ecashSendService: EcashSendService;
	let cashuWalletSwapService: jest.Mocked<CashuWalletSwapService>;
	let cashuWalletMeltService: jest.Mocked<CashuWalletMeltService>;
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
				{
					provide: CashuWalletSwapService,
					useValue: {sendToken: jest.fn(), checkToken: jest.fn(), reclaimToken: jest.fn(), previewSend: jest.fn()},
				},
				{provide: CashuWalletMeltService, useValue: {newQuote: jest.fn(), payQuote: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashSendService = module.get<EcashSendService>(EcashSendService);
		cashuWalletSwapService = module.get(CashuWalletSwapService);
		cashuWalletMeltService = module.get(CashuWalletMeltService);
		errorService = module.get(ErrorService);
	});

	it('previewSend maps the token preview', async () => {
		const preview_request = {user_id: 'user-1', mint_id: 'mint-1', unit: 'sat', amount: null, max: true};
		cashuWalletSwapService.previewSend.mockResolvedValue({amount: 90, fee: 9, total: 99, sufficient: true, balance: 100});
		const result = await ecashSendService.previewSend('TAG', preview_request);
		expect(cashuWalletSwapService.previewSend).toHaveBeenCalledWith(preview_request);
		expect(result).toBeInstanceOf(OrchardEcashSendTokenPreview);
		expect(result).toEqual({amount: 90, fee: 9, total: 99, sufficient: true, balance: 100});
	});

	it('newMeltQuote maps the melt quote with a fee row per way to pay', async () => {
		const quote_request = {
			user_id: 'user-1',
			mint_id: 'mint-1',
			method: 'onchain',
			unit: 'sat',
			request: 'bc1qaddress',
			amount: 50,
			max: false,
		};
		const fee = {fee_index: 0, estimated_blocks: 1, fee: 6, total: 56, sufficient: true};
		cashuWalletMeltService.newQuote.mockResolvedValue({quote_id: 'melt-1', amount: 50, expiry: null, balance: 100, fees: [fee]});
		const result = await ecashSendService.newMeltQuote('TAG', quote_request);
		expect(cashuWalletMeltService.newQuote).toHaveBeenCalledWith(quote_request);
		expect(result).toBeInstanceOf(OrchardEcashMeltQuote);
		expect(result).toMatchObject({quote_id: 'melt-1', amount: 50, expiry: null, balance: 100, fees: [fee]});
		expect(result.fees[0]).toBeInstanceOf(OrchardEcashMeltQuoteFee);
	});

	it('payMeltQuote returns the melt with its payment proof', async () => {
		const pay_request = {user_id: 'user-1', mint_id: 'mint-1', method: 'bolt11', unit: 'sat', quote_id: 'melt-1', fee_index: null};
		cashuWalletMeltService.payQuote.mockResolvedValue({
			...operation,
			type: 'MELT',
			state: 'FINALIZED',
			method: 'bolt11',
			request: 'lnbc100n1invoice',
			fee_reserve: 2,
			payment_proof: 'preimage',
			inputs: '[]',
		});
		const result = await ecashSendService.payMeltQuote('TAG', pay_request);
		expect(cashuWalletMeltService.payQuote).toHaveBeenCalledWith(pay_request);
		expect(result).toBeInstanceOf(OrchardEcashOperation);
		expect(result).toMatchObject({type: 'MELT', request: 'lnbc100n1invoice', fee_reserve: 2, payment_proof: 'preimage'});
		expect(result).not.toHaveProperty('inputs');
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
