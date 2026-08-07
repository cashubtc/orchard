/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {MintService} from '@server/modules/api/mint/mint.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {MintProofService} from './mintproof.service.js';
describe('MintProofService', () => {
	let mintProofService: MintProofService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintProofService,
				{provide: CashuMintDatabaseService, useValue: {listProofGroups: jest.fn()}},
				{provide: MintService, useValue: {withDbClient: jest.fn((fn: any) => fn({}))}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintProofService = module.get<MintProofService>(MintProofService);
		mintDbService = module.get(CashuMintDatabaseService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(mintProofService).toBeDefined();
	});

	it('getMintProofGroupStats returns median count', async () => {
		mintDbService.listProofGroups.mockResolvedValue([{amounts: [[1, 2, 3]]}] as any);
		const result = await mintProofService.getMintProofGroupStats('TAG', 'sat' as any);
		expect(result).toEqual({median: 3});
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		mintDbService.listProofGroups.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseSelectError});
		await expect(mintProofService.getMintProofGroupStats('MY_TAG', 'sat' as any)).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.MintDatabaseSelectError});
	});
});
