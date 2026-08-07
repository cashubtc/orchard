/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Native Dependencies */
import {MintService} from '@server/modules/api/mint/mint.service';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {MintDatabaseService} from './mintdatabase.service.js';
import {OrchardMintDatabaseBackup, OrchardMintDatabaseRestore} from './mintdatabase.model.js';

describe('MintDatabaseService', () => {
	let mintDatabaseService: MintDatabaseService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintDatabaseService,
				{provide: MintService, useValue: {withDbClient: jest.fn((fn: any) => fn({}))}},
				{provide: CashuMintDatabaseService, useValue: {createBackup: jest.fn(), restoreBackup: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintDatabaseService = module.get<MintDatabaseService>(MintDatabaseService);
		mintDbService = module.get(CashuMintDatabaseService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(mintDatabaseService).toBeDefined();
	});

	it('createMintDatabaseBackup returns OrchardMintDatabaseBackup', async () => {
		mintDbService.createBackup.mockResolvedValue(Buffer.from('file'));
		const result = await mintDatabaseService.createMintDatabaseBackup('TAG');
		expect(result).toBeInstanceOf(OrchardMintDatabaseBackup);
		expect(result.filebase64).toBe(Buffer.from('file').toString('base64'));
	});

	it('restoreMintDatabaseBackup returns OrchardMintDatabaseRestore', async () => {
		mintDbService.restoreBackup.mockResolvedValue(undefined as any);
		const result = await mintDatabaseService.restoreMintDatabaseBackup('TAG', 'Zm8=');
		expect(result).toBeInstanceOf(OrchardMintDatabaseRestore);
		expect(result.success).toBe(true);
	});

	it('wraps errors via resolveError and throws OrchardApiError on backup failure', async () => {
		mintDbService.createBackup.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseBackupError});
		await expect(mintDatabaseService.createMintDatabaseBackup('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
	});
});
