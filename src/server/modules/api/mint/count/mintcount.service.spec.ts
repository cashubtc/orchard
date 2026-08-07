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
import {MintCountService} from './mintcount.service.js';
import {OrchardMintCount} from './mintcount.model.js';

describe('MintCountService', () => {
	let mintCountService: MintCountService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintCountService,
				{
					provide: CashuMintDatabaseService,
					useValue: {
						countMintQuotes: jest.fn(),
						countMeltQuotes: jest.fn(),
					},
				},
				{provide: MintService, useValue: {withDbClient: jest.fn((fn: any) => fn({}))}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintCountService = module.get<MintCountService>(MintCountService);
		mintDbService = module.get(CashuMintDatabaseService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(mintCountService).toBeDefined();
	});

	it('getMintCountMintQuotes returns OrchardMintCount', async () => {
		mintDbService.countMintQuotes.mockResolvedValue(5 as any);
		const result = await mintCountService.getMintCountMintQuotes('TAG', {} as any);
		expect(result).toBeInstanceOf(OrchardMintCount);
		expect(result.count).toBe(5);
	});

	it('getMintCountMeltQuotes returns OrchardMintCount', async () => {
		mintDbService.countMeltQuotes.mockResolvedValue(2 as any);
		const result = await mintCountService.getMintCountMeltQuotes('TAG', {} as any);
		expect(result.count).toBe(2);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		mintDbService.countMintQuotes.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseSelectError});
		await expect(mintCountService.getMintCountMintQuotes('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
	});
});
