/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {ErrorService} from '@server/modules/error/error.service';
/* Local Dependencies */
import {MintService} from './mint.service.js';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';

describe('MintService', () => {
	let mintService: MintService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintService,
				{provide: CashuMintDatabaseService, useValue: {getMintDatabase: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintService = module.get<MintService>(MintService);
		mintDbService = module.get(CashuMintDatabaseService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(mintService).toBeDefined();
	});

	it('withDbClient: sqlite closes db and returns action result', async () => {
		const close = jest.fn();
		mintDbService.getMintDatabase.mockResolvedValue({type: 'sqlite', database: {close}} as any);
		const result = await mintService.withDbClient(async () => 42 as any);
		expect(result).toBe(42);
		expect(close).toHaveBeenCalled();
	});

	it('withDbClient: postgres connects and ends', async () => {
		const connect = jest.fn();
		const end = jest.fn();
		mintDbService.getMintDatabase.mockResolvedValue({type: 'postgres', database: {connect, end}} as any);
		const result = await mintService.withDbClient(async () => 'ok' as any);
		expect(result).toBe('ok');
		expect(connect).toHaveBeenCalled();
		expect(end).toHaveBeenCalled();
	});

	it('withDbClient: wraps connection errors and throws OrchardApiError', async () => {
		mintDbService.getMintDatabase.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseConnectionError});
		await expect(mintService.withDbClient(async () => 0 as any)).rejects.toBeInstanceOf(OrchardApiError);
	});
});
