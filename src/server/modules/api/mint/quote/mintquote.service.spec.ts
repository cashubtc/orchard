/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {MintQuoteService} from './mintquote.service.js';

describe('MintQuoteService', () => {
	let mintQuoteService: MintQuoteService;
	let mintRpcService: jest.Mocked<CashuMintRpcService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintQuoteService,
				{provide: CashuMintRpcService, useValue: {getQuoteTtl: jest.fn(), updateQuoteTtl: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintQuoteService = module.get<MintQuoteService>(MintQuoteService);
		mintRpcService = module.get(CashuMintRpcService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(mintQuoteService).toBeDefined();
	});

	it('getMintQuoteTtl returns OrchardMintQuoteTtls', async () => {
		mintRpcService.getQuoteTtl.mockResolvedValue({mint_ttl: 1, melt_ttl: 2} as any);
		const result = await mintQuoteService.getMintQuoteTtl('TAG');
		expect(result).toEqual({mint_ttl: 1, melt_ttl: 2});
	});

	it('updateMintQuoteTtl returns input and calls RPC', async () => {
		const input = {mint_ttl: 1, melt_ttl: 2} as any;
		const result = await mintQuoteService.updateMintQuoteTtl('TAG', input);
		expect(result).toEqual(input);
		expect(mintRpcService.updateQuoteTtl).toHaveBeenCalled();
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		mintRpcService.getQuoteTtl.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintRpcActionError});
		await expect(mintQuoteService.getMintQuoteTtl('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
	});
});
