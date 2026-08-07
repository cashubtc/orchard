/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintRpcService} from '@server/modules/cashu/mintrpc/cashumintrpc.service';
import {MintService} from '@server/modules/api/mint/mint.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {MintMeltQuoteService} from './mintmeltquote.service.js';
import {OrchardMintMeltQuote} from './mintmeltquote.model.js';

describe('MintMeltQuoteService', () => {
	let mintMeltQuoteService: MintMeltQuoteService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let mintRpcService: jest.Mocked<CashuMintRpcService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintMeltQuoteService,
				{provide: CashuMintDatabaseService, useValue: {listMeltQuotes: jest.fn()}},
				{provide: CashuMintRpcService, useValue: {updateNut05: jest.fn()}},
				{provide: MintService, useValue: {withDbClient: jest.fn((fn: any) => fn({}))}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintMeltQuoteService = module.get<MintMeltQuoteService>(MintMeltQuoteService);
		mintDbService = module.get(CashuMintDatabaseService);
		mintRpcService = module.get(CashuMintRpcService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(mintMeltQuoteService).toBeDefined();
	});

	it('getMintMeltQuotes returns OrchardMintMeltQuote[]', async () => {
		mintDbService.listMeltQuotes.mockResolvedValue([{id: 'q', unit: 'sat'}] as any);
		const result = await mintMeltQuoteService.getMintMeltQuotes('TAG', {} as any);
		expect(result[0]).toBeInstanceOf(OrchardMintMeltQuote);
	});

	it('updateMintNut05 returns input and calls RPC', async () => {
		const result = await mintMeltQuoteService.updateMintNut05('TAG', 'sat', 'bolt11');
		expect(result).toEqual({unit: 'sat', method: 'bolt11', disabled: undefined, min_amount: undefined, max_amount: undefined});
		expect(mintRpcService.updateNut05).toHaveBeenCalled();
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		mintDbService.listMeltQuotes.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseSelectError});
		await expect(mintMeltQuoteService.getMintMeltQuotes('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.MintDatabaseSelectError});
	});
});
