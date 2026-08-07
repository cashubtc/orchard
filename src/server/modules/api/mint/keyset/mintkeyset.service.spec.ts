/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Native Dependencies */
import {MintService} from '#server/modules/api/mint/mint.service';
/* Application Dependencies */
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintAnalyticsService} from '#server/modules/cashu/mintanalytics/mintanalytics.service';
import {MintAnalyticsMetric} from '#server/modules/cashu/mintanalytics/mintanalytics.enums';
import {MintAnalytics} from '#server/modules/cashu/mintanalytics/mintanalytics.entity';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {BitcoinUTXOracleService} from '#server/modules/bitcoin/utxoracle/utxoracle.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {MintKeysetService} from './mintkeyset.service.js';
import {OrchardMintKeyset, OrchardMintKeysetCount} from './mintkeyset.model.js';

/** Helper: builds a cache row with sensible defaults */
function makeCacheRow(overrides: Partial<MintAnalytics> = {}): MintAnalytics {
	return {
		id: 'uuid',
		mint_pubkey: 'pk',
		keyset_id: 'ks1',
		unit: 'sat',
		metric: MintAnalyticsMetric.keyset_issued,
		date: 1700000000,
		amount: '100',
		count: 5,
		updated_at: 1700003600,
		...overrides,
	} as MintAnalytics;
}

describe('MintKeysetService', () => {
	let mintKeysetService: MintKeysetService;
	let mintDbService: jest.Mocked<CashuMintDatabaseService>;
	let analyticsService: jest.Mocked<CashuMintAnalyticsService>;
	let mintRpcService: jest.Mocked<CashuMintRpcService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintKeysetService,
				{provide: BitcoinUTXOracleService, useValue: {getOraclePrice: jest.fn().mockResolvedValue(null)}},
				{provide: MintService, useValue: {withDbClient: jest.fn((fn: any) => fn({}))}},
				{provide: CashuMintDatabaseService, useValue: {getKeysets: jest.fn(), getMintKeysetCounts: jest.fn()}},
				{provide: CashuMintAnalyticsService, useValue: {getCachedAnalytics: jest.fn().mockResolvedValue([])}},
				{provide: CashuMintRpcService, useValue: {rotateNextKeyset: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		mintKeysetService = module.get<MintKeysetService>(MintKeysetService);
		mintDbService = module.get(CashuMintDatabaseService);
		analyticsService = module.get(CashuMintAnalyticsService);
		mintRpcService = module.get(CashuMintRpcService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(mintKeysetService).toBeDefined();
	});

	it('getMintKeysets returns OrchardMintKeyset[]', async () => {
		mintDbService.getKeysets.mockResolvedValue([{id: 'k'}] as any);
		const result = await mintKeysetService.getMintKeysets('TAG');
		expect(result[0]).toBeInstanceOf(OrchardMintKeyset);
	});

	it('getMintKeysets maps final_expiry onto the model', async () => {
		mintDbService.getKeysets.mockResolvedValue([{id: 'k', final_expiry: 1893456000}] as any);
		const result = await mintKeysetService.getMintKeysets('TAG');
		expect(result[0].final_expiry).toBe(1893456000);
	});

	it('getMintKeysetCounts returns OrchardMintKeysetCount[] from cache', async () => {
		analyticsService.getCachedAnalytics.mockResolvedValue([
			makeCacheRow({keyset_id: 'ks1', metric: MintAnalyticsMetric.keyset_issued, count: 10}),
			makeCacheRow({keyset_id: 'ks1', metric: MintAnalyticsMetric.keyset_redeemed, count: 7}),
		]);
		const result = await mintKeysetService.getMintKeysetCounts('TAG');
		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(OrchardMintKeysetCount);
		expect(result[0].id).toBe('ks1');
		expect(result[0].promise_count).toBe(10);
		expect(result[0].proof_count).toBe(7);
	});

	it('getMintKeysetCounts sums counts across hourly buckets', async () => {
		analyticsService.getCachedAnalytics.mockResolvedValue([
			makeCacheRow({keyset_id: 'ks1', metric: MintAnalyticsMetric.keyset_issued, date: 1700000000, count: 3}),
			makeCacheRow({keyset_id: 'ks1', metric: MintAnalyticsMetric.keyset_issued, date: 1700003600, count: 5}),
			makeCacheRow({keyset_id: 'ks1', metric: MintAnalyticsMetric.keyset_redeemed, date: 1700000000, count: 2}),
		]);
		const result = await mintKeysetService.getMintKeysetCounts('TAG');
		expect(result[0].promise_count).toBe(8);
		expect(result[0].proof_count).toBe(2);
	});

	it('getMintKeysetCounts groups by keyset_id', async () => {
		analyticsService.getCachedAnalytics.mockResolvedValue([
			makeCacheRow({keyset_id: 'ks1', metric: MintAnalyticsMetric.keyset_issued, count: 10}),
			makeCacheRow({keyset_id: 'ks2', metric: MintAnalyticsMetric.keyset_issued, count: 20}),
			makeCacheRow({keyset_id: 'ks2', metric: MintAnalyticsMetric.keyset_redeemed, count: 5}),
		]);
		const result = await mintKeysetService.getMintKeysetCounts('TAG');
		expect(result).toHaveLength(2);
		const ks1 = result.find((r) => r.id === 'ks1')!;
		const ks2 = result.find((r) => r.id === 'ks2')!;
		expect(ks1.promise_count).toBe(10);
		expect(ks1.proof_count).toBe(0);
		expect(ks2.promise_count).toBe(20);
		expect(ks2.proof_count).toBe(5);
	});

	it('getMintKeysetCounts filters by id_keysets when provided', async () => {
		analyticsService.getCachedAnalytics.mockResolvedValue([
			makeCacheRow({keyset_id: 'ks1', metric: MintAnalyticsMetric.keyset_issued, count: 10}),
			makeCacheRow({keyset_id: 'ks2', metric: MintAnalyticsMetric.keyset_issued, count: 20}),
		]);
		const result = await mintKeysetService.getMintKeysetCounts('TAG', {id_keysets: ['ks1']});
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('ks1');
	});

	it('getMintKeysetCounts passes date range to cache query', async () => {
		await mintKeysetService.getMintKeysetCounts('TAG', {date_start: 1000, date_end: 2000});
		expect(analyticsService.getCachedAnalytics).toHaveBeenCalledWith({
			date_start: 1000,
			date_end: 2000,
			metrics: [MintAnalyticsMetric.keyset_issued, MintAnalyticsMetric.keyset_redeemed],
		});
	});

	it('getMintKeysetCounts returns empty array when cache is empty', async () => {
		const result = await mintKeysetService.getMintKeysetCounts('TAG');
		expect(result).toEqual([]);
	});

	it('mintRotateKeyset returns input on success', async () => {
		mintRpcService.rotateNextKeyset.mockResolvedValue({} as any);
		const result = await mintKeysetService.mintRotateKeyset('TAG', {unit: 'sat'} as any);
		expect(result).toBeDefined();
	});

	it('mintRotateKeyset forwards final_expiry to rotateNextKeyset', async () => {
		mintRpcService.rotateNextKeyset.mockResolvedValue({} as any);
		await mintKeysetService.mintRotateKeyset('TAG', {unit: 'sat', final_expiry: 1893456000} as any);
		expect(mintRpcService.rotateNextKeyset).toHaveBeenCalledWith({unit: 'sat', final_expiry: 1893456000});
	});

	it('wraps errors via resolveError and throws OrchardApiError (db)', async () => {
		mintDbService.getKeysets.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseSelectError});
		await expect(mintKeysetService.getMintKeysets('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.MintDatabaseSelectError});
	});

	it('wraps cache errors and throws OrchardApiError (counts)', async () => {
		analyticsService.getCachedAnalytics.mockRejectedValue(new Error('cache error'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.MintDatabaseSelectError});
		await expect(mintKeysetService.getMintKeysetCounts('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
	});
});
