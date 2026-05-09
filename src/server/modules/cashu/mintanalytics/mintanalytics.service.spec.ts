/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {getRepositoryToken} from '@nestjs/typeorm';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintApiService} from '@server/modules/cashu/mintapi/cashumintapi.service';
import {AnalyticsCheckpoint} from '@server/modules/analytics/analytics-checkpoint.entity';
/* Local Dependencies */
import {CashuMintAnalyticsService} from './mintanalytics.service';
import {MintAnalytics} from './mintanalytics.entity';

describe('CashuMintAnalyticsService', () => {
	let service: CashuMintAnalyticsService;
	let configService: jest.Mocked<ConfigService>;
	let cashuMintDatabaseService: jest.Mocked<CashuMintDatabaseService>;
	let checkpointRepository: {findOne: jest.Mock; upsert: jest.Mock};

	beforeEach(async () => {
		checkpointRepository = {findOne: jest.fn(), upsert: jest.fn()};
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuMintAnalyticsService,
				{
					provide: getRepositoryToken(MintAnalytics),
					useValue: {find: jest.fn(), findOne: jest.fn(), count: jest.fn(), upsert: jest.fn()},
				},
				{
					provide: getRepositoryToken(AnalyticsCheckpoint),
					useValue: checkpointRepository,
				},
				{
					provide: CashuMintDatabaseService,
					useValue: {
						getMintDatabase: jest.fn(),
						listMintQuotes: jest.fn(),
						listMeltQuotes: jest.fn(),
						listSwaps: jest.fn(),
						listFees: jest.fn(),
						listProofs: jest.fn(),
						listPromises: jest.fn(),
					},
				},
				{
					provide: CashuMintApiService,
					useValue: {getMintInfo: jest.fn().mockResolvedValue({pubkey: 'test-pubkey'})},
				},
				{
					provide: ConfigService,
					useValue: {get: jest.fn()},
				},
			],
		}).compile();

		service = module.get<CashuMintAnalyticsService>(CashuMintAnalyticsService);
		configService = module.get(ConfigService);
		cashuMintDatabaseService = module.get(CashuMintDatabaseService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('returns backfill status with is_running false by default', () => {
		const status = service.getBackfillStatus();

		expect(status).toBeDefined();
		expect(status.is_running).toBe(false);
	});

	it('skips auto-backfill when cashu is not configured', async () => {
		configService.get.mockReturnValue(undefined);

		await service.onApplicationBootstrap();

		expect(cashuMintDatabaseService.getMintDatabase).not.toHaveBeenCalled();
	});

	it('guards against concurrent backfill execution', async () => {
		configService.get.mockImplementation((key: string) => {
			if (key === 'cashu.type') return 'cdk';
			if (key === 'cashu.database') return '/tmp/test.db';
			return undefined;
		});

		// Simulate a running backfill by calling runBackfill with a DB that never resolves
		let resolve_db: (value: any) => void;
		cashuMintDatabaseService.getMintDatabase.mockReturnValue(
			new Promise((r) => {
				resolve_db = r;
			}),
		);

		const first_run = service.runBackfill();

		// Give the first run time to set is_running
		await new Promise((r) => setTimeout(r, 10));

		// Resolve DB with a mock that returns empty batches
		resolve_db!({
			type: 'sqlite',
			database: {close: jest.fn()},
		});

		await first_run;

		// Second call should work since first is done
		cashuMintDatabaseService.getMintDatabase.mockResolvedValue({
			type: 'sqlite',
			database: {close: jest.fn()},
		} as any);
		cashuMintDatabaseService.listMintQuotes.mockResolvedValue([]);
		cashuMintDatabaseService.listMeltQuotes.mockResolvedValue([]);
		cashuMintDatabaseService.listSwaps.mockResolvedValue([]);
		cashuMintDatabaseService.listFees.mockResolvedValue([]);
		cashuMintDatabaseService.listProofs.mockResolvedValue([]);
		cashuMintDatabaseService.listPromises.mockResolvedValue([]);

		await service.runBackfill();

		expect(cashuMintDatabaseService.getMintDatabase).toHaveBeenCalledTimes(2);
	});

	/* *******************************************************
		Checkpoint hour-alignment invariant

		Checkpoints MUST always land on an hour boundary. `upsertMetric` uses
		REPLACE-on-conflict for (keyset, unit, metric, hour) rows, so any resume
		or rescan that starts mid-hour would refetch only a partial hour and
		silently overwrite the complete total with a partial one. These tests
		guard the invariant at its single enforcement point: `saveCheckpoint`.
	******************************************************** */

	describe('saveCheckpoint hour-alignment', () => {
		const HOUR = 3600;
		// 2025-06-15 14:00:00 UTC — a known hour boundary
		const hour_aligned = 1750000800 - (1750000800 % HOUR);

		beforeEach(() => {
			// The service calls getMintPubkey() → uses cached mint_pubkey.
			(service as any).mint_pubkey = 'test-pubkey';
		});

		it('hour-aligns a mid-hour progressive checkpoint', async () => {
			const mid_hour = hour_aligned + 1337; // arbitrary seconds into the hour
			await (service as any).saveCheckpoint('promises', mid_hour);

			expect(checkpointRepository.upsert).toHaveBeenCalledTimes(1);
			const saved = checkpointRepository.upsert.mock.calls[0][0];
			expect(saved.last_index).toBe(hour_aligned);
			expect(saved.last_index % HOUR).toBe(0);
		});

		it('leaves an already-aligned checkpoint unchanged', async () => {
			await (service as any).saveCheckpoint('proofs', hour_aligned);

			const saved = checkpointRepository.upsert.mock.calls[0][0];
			expect(saved.last_index).toBe(hour_aligned);
		});

		it('passes through zero (never-run sentinel)', async () => {
			await (service as any).saveCheckpoint('promises', 0);

			const saved = checkpointRepository.upsert.mock.calls[0][0];
			expect(saved.last_index).toBe(0);
		});

		it('produces an hour-aligned rewind when rescanRecentRecords starts from a mid-hour checkpoint', async () => {
			// Simulate the historical bug condition: a mid-hour checkpoint left behind
			// by an interrupted run. rescanRecentRecords subtracts RESCAN_SECONDS; without
			// alignment the rewound value would also be mid-hour and cause partial-hour
			// re-processing + REPLACE-style data loss.
			const mid_hour_checkpoint = hour_aligned + 42;
			checkpointRepository.findOne.mockResolvedValue({last_index: mid_hour_checkpoint});

			// Stub runBackfill so the test only exercises the checkpoint-rewind path.
			jest.spyOn(service, 'runBackfill').mockResolvedValue(undefined);

			await service.rescanRecentRecords();

			// One upsert per CHECKPOINT_DATA_TYPE (5). All must be hour-aligned.
			expect(checkpointRepository.upsert).toHaveBeenCalled();
			for (const call of checkpointRepository.upsert.mock.calls) {
				const saved = call[0];
				expect(saved.last_index % HOUR).toBe(0);
			}
		});
	});

	/* *******************************************************
		streamAndBucket final-batch boundary handling

		Regression guard for a ~300-sat balance drift seen against a
		nutshell mint: the streaming backfill defers rows at `last_time`
		to the next batch so same-timestamp clusters don't split across
		pages, but on the final batch (batch.length < BATCH_SIZE) there
		is no next batch — without a final-batch exception those tail
		rows at MAX(created_time) are silently dropped.
	******************************************************** */

	describe('streamAndBucket final-batch boundary handling', () => {
		const HOUR = 3600;
		const hour_aligned = 1750000800 - (1750000800 % HOUR);

		beforeEach(() => {
			(service as any).mint_pubkey = 'test-pubkey';
		});

		it('buckets records sharing MAX(created_time) when batch is final', async () => {
			const current_hour = hour_aligned + HOUR;
			const max_time = hour_aligned + 2700;
			const proofs = [
				...Array.from({length: 40}, (_, i) => ({
					amount: 10,
					keyset_id: 'ks1',
					unit: 'sat',
					created_time: hour_aligned + i,
					state: 'SPENT',
				})),
				...Array.from({length: 5}, () => ({
					amount: 61,
					keyset_id: 'ks1',
					unit: 'sat',
					created_time: max_time,
					state: 'SPENT',
				})),
			];

			const inserter = jest.fn();
			const fetcher = jest.fn().mockResolvedValueOnce(proofs).mockResolvedValueOnce([]);

			await (service as any).streamAndBucket(current_hour, 'proofs', fetcher, inserter);

			const inserted = inserter.mock.calls.flatMap((call: any[]) => call[1]);
			expect(inserted).toHaveLength(45);
			const total_amount = inserted.reduce((sum: number, r: any) => sum + r.amount, 0);
			expect(total_amount).toBe(40 * 10 + 5 * 61);
		});
	});

	it('getCachedAnalytics returns filtered results', async () => {
		configService.get.mockImplementation((key: string) => {
			if (key === 'cashu.pubkey') return 'test-pubkey';
			return undefined;
		});

		const mock_repo = {
			find: jest.fn().mockResolvedValue([]),
		};
		(service as any).mintAnalyticsRepository = mock_repo;

		const result = await service.getCachedAnalytics({
			date_start: 1700000000,
			date_end: 1700003600,
		});

		expect(result).toEqual([]);
		expect(mock_repo.find).toHaveBeenCalled();
	});
});
