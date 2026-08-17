/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {MintService} from '#server/modules/api/mint/mint.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {MintSwapService} from './mintswap.service.js';
import {OrchardMintSwap} from './mintswap.model.js';

describe('MintSwapService', () => {
	let mintSwapService: MintSwapService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintSwapService,
				{provide: CashuMintDatabaseService, useValue: {listSwaps: jest.fn()}},
				{provide: MintService, useValue: {withDbClient: jest.fn((fn: any) => fn({}))}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintSwapService = module.get<MintSwapService>(MintSwapService);
		mintDbService = module.get(CashuMintDatabaseService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(mintSwapService).toBeDefined();
	});

	it('getMintSwaps returns OrchardMintSwap[]', async () => {
		mintDbService.listSwaps.mockResolvedValue([
			{operation_id: 'op1', keyset_ids: ['k1'], unit: 'sat', amount: 100, created_time: 1000, fee: 1},
		] as any);
		const result = await mintSwapService.getMintSwaps('TAG', {} as any);
		expect(result[0]).toBeInstanceOf(OrchardMintSwap);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		mintDbService.listSwaps.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseSelectError});
		await expect(mintSwapService.getMintSwaps('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.MintDatabaseSelectError});
	});
});
