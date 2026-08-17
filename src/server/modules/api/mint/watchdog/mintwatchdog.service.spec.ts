/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Native Dependencies */
import {MintService} from '#server/modules/api/mint/mint.service';
/* Application Dependencies */
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {MintWatchdogService} from './mintwatchdog.service.js';
import {OrchardMintWatchdogStatus} from './mintwatchdog.model.js';

describe('MintWatchdogService', () => {
	let mintWatchdogService: MintWatchdogService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintWatchdogService,
				{provide: MintService, useValue: {withDbClient: jest.fn((fn: any) => fn({}))}},
				{provide: CashuMintDatabaseService, useValue: {getWatchdogLastSeen: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintWatchdogService = module.get<MintWatchdogService>(MintWatchdogService);
		mintDbService = module.get(CashuMintDatabaseService);
		errorService = module.get(ErrorService);
	});

	it('reports is_alive=true when last_seen is within the freshness window', async () => {
		const recent = DateTime.utc().toUnixInteger() - 30; // 30s ago
		mintDbService.getWatchdogLastSeen.mockResolvedValue(recent);
		const result = await mintWatchdogService.getWatchdogStatus('TAG');
		expect(result).toBeInstanceOf(OrchardMintWatchdogStatus);
		expect(result.is_alive).toBe(true);
		expect(result.last_seen).toBe(recent);
	});

	it('reports is_alive=false when last_seen is older than the freshness window', async () => {
		const stale = DateTime.utc().toUnixInteger() - 100000; // ~27.8h ago
		mintDbService.getWatchdogLastSeen.mockResolvedValue(stale);
		const result = await mintWatchdogService.getWatchdogStatus('TAG');
		expect(result.is_alive).toBe(false);
		expect(result.last_seen).toBe(stale);
	});

	it('reports is_alive=false with last_seen=null when balance_log is empty', async () => {
		mintDbService.getWatchdogLastSeen.mockResolvedValue(null);
		const result = await mintWatchdogService.getWatchdogStatus('TAG');
		expect(result.is_alive).toBe(false);
		expect(result.last_seen).toBeNull();
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		mintDbService.getWatchdogLastSeen.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseSelectError});
		await expect(mintWatchdogService.getWatchdogStatus('TAG')).rejects.toBeInstanceOf(OrchardApiError);
	});
});
