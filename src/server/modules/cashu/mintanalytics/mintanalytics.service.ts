/* Core Dependencies */
import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository, FindOptionsWhere, Between, In} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintApiService} from '@server/modules/cashu/mintapi/cashumintapi.service';
import {AnalyticsCheckpoint} from '@server/modules/analytics/analytics-checkpoint.entity';
import {
	CashuMintDatabase,
	CashuMintMintQuote,
	CashuMintMeltQuote,
	CashuMintSwap,
	CashuMintProof,
	CashuMintPromise,
	CashuMintOperationFee,
} from '@server/modules/cashu/mintdb/cashumintdb.types';
import {MintQuoteState, MeltQuoteState, MintProofState} from '@server/modules/cashu/cashu.enums';
import {AnalyticsBackfillStatus} from '@server/modules/analytics/analytics.interfaces';
/* Native Dependencies */
import {MintAnalytics} from './mintanalytics.entity';
import {MintAnalyticsMetric} from './mintanalytics.enums';
import {MintAnalyticsCachedArgs} from './mintanalytics.interfaces';

const BATCH_SIZE = 500;
const BATCH_DELAY_MS = 5000;
const MAX_PENDING_RECORDS = 100_000;
const FORCE_FLUSH_COUNT = 10;
const RESCAN_SECONDS = 86400 * 7;

type CheckpointDataType = 'mint_quotes' | 'melt_quotes' | 'swaps' | 'fees' | 'proofs' | 'promises';
const CHECKPOINT_DATA_TYPES: CheckpointDataType[] = ['mint_quotes', 'melt_quotes', 'swaps', 'fees', 'proofs', 'promises'];

@Injectable()
export class CashuMintAnalyticsService implements OnApplicationBootstrap {
	private readonly logger = new Logger(CashuMintAnalyticsService.name);
	private backfill_status: AnalyticsBackfillStatus = {is_running: false};
	private mint_pubkey: string | null = null;

	constructor(
		@InjectRepository(MintAnalytics)
		private mintAnalyticsRepository: Repository<MintAnalytics>,
		@InjectRepository(AnalyticsCheckpoint)
		private checkpointRepository: Repository<AnalyticsCheckpoint>,
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private cashuMintApiService: CashuMintApiService,
		private configService: ConfigService,
	) {}

	async onApplicationBootstrap() {
		if (process.env.SCHEMA_ONLY) return;
		const cashu_type = this.configService.get<string>('cashu.type');
		if (!cashu_type) {
			this.logger.log('Cashu not configured, skipping auto-backfill');
			return;
		}

		this.runBackfill().catch((error) => {
			this.logger.error('Error during cashu mint analytics auto-backfill', error);
		});
	}

	/* *******************************************************
		Public API
	******************************************************** */

	/** Returns the current backfill status */
	getBackfillStatus(): AnalyticsBackfillStatus {
		return {...this.backfill_status};
	}

	/** Gets cached analytics for a date range */
	async getCachedAnalytics(args: MintAnalyticsCachedArgs): Promise<MintAnalytics[]> {
		const mint_pubkey = await this.getMintPubkey();
		const where: FindOptionsWhere<MintAnalytics> = {mint_pubkey};

		if (args.date_start !== undefined && args.date_end !== undefined) {
			const start_hour = DateTime.fromSeconds(args.date_start, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			const end_hour = DateTime.fromSeconds(args.date_end, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			where.date = Between(start_hour, end_hour);
		}

		if (args.metrics?.length) {
			where.metric = In(args.metrics);
		}

		if (args.units?.length) {
			where.unit = In(args.units);
		}

		return this.mintAnalyticsRepository.find({where, order: {date: 'ASC'}});
	}

	/** Runs the streaming backfill - opens ONE external DB connection, runs 5 streams, closes */
	async runBackfill(): Promise<void> {
		if (this.backfill_status.is_running) {
			this.logger.warn('Backfill already running');
			return;
		}

		this.backfill_status = {is_running: true, total_streams: 6, streams_completed: 0, errors: 0};

		let client: CashuMintDatabase;
		try {
			client = await this.cashuMintDatabaseService.getMintDatabase();
			if (client.type === 'postgres') await client.database.connect();
		} catch (error) {
			this.logger.error('Failed to connect to mint database for backfill', error);
			this.backfill_status = {is_running: false, total_streams: 0, streams_completed: 0, errors: 0};
			return;
		}
		this.logger.log('Starting cashu mint analytics backfill');

		try {
			await this.getMintPubkey().catch(() => null);
			if (!this.mint_pubkey) {
				this.logger.warn('Mint not reachable, skipping analytics backfill');
				return;
			}
			const current_hour = DateTime.utc().startOf('hour').toUnixInteger();

			await this.streamAndBucket<CashuMintMintQuote>(
				current_hour,
				'mint_quotes',
				({page_size, sort_order, date_start}) =>
					this.cashuMintDatabaseService.listMintQuotes(client, {page_size, sort_order, date_start}),
				(h, records) => this.insertMintQuoteMetrics(h, records),
			);
			this.backfill_status.streams_completed++;
			await this.streamAndBucket<CashuMintMeltQuote>(
				current_hour,
				'melt_quotes',
				({page_size, sort_order, date_start}) =>
					this.cashuMintDatabaseService.listMeltQuotes(client, {page_size, sort_order, date_start}),
				(h, records) => this.insertMeltQuoteMetrics(h, records),
			);
			this.backfill_status.streams_completed++;
			await this.streamAndBucket<CashuMintSwap>(
				current_hour,
				'swaps',
				({page_size, sort_order, date_start}) =>
					this.cashuMintDatabaseService.listSwaps(client, {page_size, sort_order, date_start}),
				(h, records) => this.insertSwapMetrics(h, records),
			);
			this.backfill_status.streams_completed++;
			await this.streamAndBucket<CashuMintOperationFee>(
				current_hour,
				'fees',
				({page_size, sort_order, date_start}) =>
					this.cashuMintDatabaseService.listFees(client, {page_size, sort_order, date_start}),
				(h, records) => this.insertFeeMetrics(h, records),
			);
			this.backfill_status.streams_completed++;
			await this.streamAndBucket<CashuMintProof>(
				current_hour,
				'proofs',
				({page_size, sort_order, date_start}) =>
					this.cashuMintDatabaseService.listProofs(client, {
						page_size,
						sort_order,
						date_start,
						states: [MintProofState.SPENT],
					}),
				(h, records) => this.insertProofMetrics(h, records),
			);
			this.backfill_status.streams_completed++;
			await this.streamAndBucket<CashuMintPromise>(
				current_hour,
				'promises',
				({page_size, sort_order, date_start}) =>
					this.cashuMintDatabaseService.listPromises(client, {page_size, sort_order, date_start}),
				(h, records) => this.insertPromiseMetrics(h, records),
			);
			this.backfill_status.streams_completed++;

			this.logger.log('Cashu mint analytics backfill complete');
		} catch (error) {
			this.logger.error('Cashu mint analytics backfill error', error);
			this.backfill_status.errors++;
		} finally {
			if (client.type === 'sqlite') client.database.close();
			if (client.type === 'postgres') client.database.end();
			this.backfill_status.is_running = false;
		}
	}

	/** Re-scans recent records to catch state changes (UNPAID → PAID → ISSUED) */
	async rescanRecentRecords(): Promise<void> {
		if (this.backfill_status.is_running) {
			this.logger.warn('Backfill already running, skipping rescan');
			return;
		}

		this.logger.log('Resetting checkpoints to re-scan recent records');
		for (const data_type of CHECKPOINT_DATA_TYPES) {
			const checkpoint = await this.getCheckpoint(data_type);
			await this.saveCheckpoint(data_type, Math.max(0, checkpoint - RESCAN_SECONDS));
		}

		await this.runBackfill();
	}

	/* *******************************************************
		Stream Methods
	******************************************************** */

	/**
	 * Cursor-based streaming backfill. Pages through the mint DB ordered by `created_time`,
	 * buckets records by hour, and flushes full hours to the inserter.
	 *
	 * Pagination avoids OFFSET by carrying `cursor = last_time` into the next query. To keep
	 * same-timestamp clusters from being split across two pages, rows at `last_time` are
	 * deferred to the next batch — except on the final batch (batch.length < BATCH_SIZE) or
	 * when every record shares one timestamp, where they're included outright. Without the
	 * final-batch exception the tail rows at MAX(created_time) are silently dropped.
	 *
	 * Progressive checkpoints are saved at the hour-aligned flush boundary so a resume never
	 * starts mid-hour; a final checkpoint at current_hour advances past any buffered rows
	 * skipped because hour >= current_hour.
	 */
	private async streamAndBucket<T extends {created_time: number}>(
		current_hour: number,
		data_type: CheckpointDataType,
		fetcher: (opts: {page_size: number; sort_order: 'ASC' | 'DESC'; date_start?: number}) => Promise<T[]>,
		inserter: (hour: number, records: T[]) => Promise<void>,
	): Promise<void> {
		const checkpoint_ts = await this.getCheckpoint(data_type);
		let cursor = checkpoint_ts > 0 ? checkpoint_ts : undefined;
		let has_data = false;
		const pending_bucket: Map<number, T[]> = new Map();

		while (true) {
			const batch = await fetcher({page_size: BATCH_SIZE, sort_order: 'ASC', date_start: cursor});
			if (batch.length === 0) break;
			has_data = true;

			const first_time = batch[0].created_time;
			const last_time = batch[batch.length - 1].created_time;
			const all_same_timestamp = first_time === last_time;
			const is_final_batch = batch.length < BATCH_SIZE;
			const cutoff = all_same_timestamp || is_final_batch ? Infinity : last_time;

			for (const record of batch) {
				if (record.created_time >= cutoff) continue;
				const hour = DateTime.fromSeconds(record.created_time, {zone: 'UTC'}).startOf('hour').toUnixInteger();
				if (hour >= current_hour) continue;
				if (!pending_bucket.has(hour)) pending_bucket.set(hour, []);
				pending_bucket.get(hour)!.push(record);
			}

			if (all_same_timestamp) {
				if (batch.length >= BATCH_SIZE) {
					this.logger.warn(`All ${batch.length} records in batch share timestamp ${last_time}, advancing cursor`);
				}
				cursor = last_time + 1;
			} else {
				cursor = last_time;
			}

			const safe_boundary = DateTime.fromSeconds(first_time, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			const complete_hours = Array.from(pending_bucket.keys()).filter((h) => h < safe_boundary);
			for (const hour of complete_hours.sort((a, b) => a - b)) {
				await inserter(hour, pending_bucket.get(hour)!);
				pending_bucket.delete(hour);
				this.recordProcessedHour(hour);
			}

			if (complete_hours.length > 0) {
				await this.saveCheckpoint(data_type, safe_boundary);
			}

			if (batch.length < BATCH_SIZE) break;
			await this.forceFlushIfNeeded(pending_bucket, inserter);
			await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
		}

		await this.flushBuckets(pending_bucket, inserter);

		if (has_data) {
			await this.saveCheckpoint(data_type, current_hour);
		}
	}

	/* *******************************************************
		Metric Insertion
	******************************************************** */

	/** Inserts mint quote metrics for a specific hour */
	private async insertMintQuoteMetrics(hour: number, quotes: CashuMintMintQuote[]): Promise<void> {
		const mint_pubkey = this.mint_pubkey!;
		const by_unit = this.groupByUnit(quotes, (q) => q.unit);

		for (const [unit, unit_quotes] of by_unit) {
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.mints_created,
				hour,
				amount: BigInt(0),
				count: unit_quotes.length,
			});

			const issued = unit_quotes.filter((q) => q.state === MintQuoteState.ISSUED);
			const mints_amount = issued.reduce((sum, q) => sum + BigInt(q.amount_issued), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.mints_amount,
				hour,
				amount: mints_amount,
				count: issued.length,
			});

			const with_timing = issued.filter((q) => q.issued_time !== null && q.issued_time !== undefined);
			const total_completion = with_timing.reduce((sum, q) => sum + BigInt(Math.max(0, q.issued_time! - q.created_time)), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.mints_completion_time,
				hour,
				amount: total_completion,
				count: with_timing.length,
			});
		}
	}

	/** Inserts melt quote metrics for a specific hour */
	private async insertMeltQuoteMetrics(hour: number, quotes: CashuMintMeltQuote[]): Promise<void> {
		const mint_pubkey = this.mint_pubkey!;
		const by_unit = this.groupByUnit(quotes, (q) => q.unit);

		for (const [unit, unit_quotes] of by_unit) {
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.melts_created,
				hour,
				amount: BigInt(0),
				count: unit_quotes.length,
			});

			const paid = unit_quotes.filter((q) => q.state === MeltQuoteState.PAID);
			const melts_amount = paid.reduce((sum, q) => sum + BigInt(q.amount), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.melts_amount,
				hour,
				amount: melts_amount,
				count: paid.length,
			});

			const with_timing = paid.filter((q) => q.paid_time !== null && q.paid_time !== undefined);
			const total_completion = with_timing.reduce((sum, q) => sum + BigInt(Math.max(0, q.paid_time! - q.created_time)), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.melts_completion_time,
				hour,
				amount: total_completion,
				count: with_timing.length,
			});
		}
	}

	/** Inserts swap metrics for a specific hour */
	private async insertSwapMetrics(hour: number, swaps: CashuMintSwap[]): Promise<void> {
		const mint_pubkey = this.mint_pubkey!;
		const by_unit = this.groupByUnit(swaps, (s) => s.unit);

		for (const [unit, unit_swaps] of by_unit) {
			const swaps_amount = unit_swaps.reduce((sum, s) => sum + BigInt(s.amount), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.swaps_amount,
				hour,
				amount: swaps_amount,
				count: unit_swaps.length,
			});
		}
	}

	/** Inserts fee metrics for a specific hour from the unified operation-fee stream */
	private async insertFeeMetrics(hour: number, fees: CashuMintOperationFee[]): Promise<void> {
		const mint_pubkey = this.mint_pubkey!;
		const by_unit = this.groupByUnit(fees, (f) => f.unit);

		for (const [unit, unit_fees] of by_unit) {
			const total = unit_fees.reduce((sum, f) => sum + BigInt(f.fee || 0), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.fees_amount,
				hour,
				amount: total,
				count: unit_fees.length,
			});
		}
	}

	/** Inserts proof metrics (redeemed) for a specific hour */
	private async insertProofMetrics(hour: number, proofs: CashuMintProof[]): Promise<void> {
		const mint_pubkey = this.mint_pubkey!;

		const by_unit = this.groupByUnit(proofs, (p) => p.unit);
		for (const [unit, unit_proofs] of by_unit) {
			const redeemed_amount = unit_proofs.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.redeemed_amount,
				hour,
				amount: redeemed_amount,
				count: unit_proofs.length,
			});
		}

		const by_keyset = this.groupByKeysetAndUnit(
			proofs,
			(p) => p.keyset_id,
			(p) => p.unit,
		);
		for (const [key, keyset_proofs] of by_keyset) {
			const [keyset_id, unit] = key.split('|');
			const amount = keyset_proofs.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id,
				unit,
				metric: MintAnalyticsMetric.keyset_redeemed,
				hour,
				amount,
				count: keyset_proofs.length,
			});
		}
	}

	/** Inserts promise metrics (issued) for a specific hour */
	private async insertPromiseMetrics(hour: number, promises: CashuMintPromise[]): Promise<void> {
		const mint_pubkey = this.mint_pubkey!;

		const by_unit = this.groupByUnit(promises, (p) => p.unit);
		for (const [unit, unit_promises] of by_unit) {
			const issued_amount = unit_promises.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id: '',
				unit,
				metric: MintAnalyticsMetric.issued_amount,
				hour,
				amount: issued_amount,
				count: unit_promises.length,
			});
		}

		const by_keyset = this.groupByKeysetAndUnit(
			promises,
			(p) => p.keyset_id,
			(p) => p.unit,
		);
		for (const [key, keyset_promises] of by_keyset) {
			const [keyset_id, unit] = key.split('|');
			const amount = keyset_promises.reduce((sum, p) => sum + BigInt(p.amount), BigInt(0));
			await this.upsertMetric({
				mint_pubkey,
				keyset_id,
				unit,
				metric: MintAnalyticsMetric.keyset_issued,
				hour,
				amount,
				count: keyset_promises.length,
			});
		}
	}

	/* *******************************************************
		Checkpoint Methods
	******************************************************** */

	/** Gets the checkpoint for a specific data type */
	async getCheckpoint(data_type: CheckpointDataType): Promise<number> {
		const mint_pubkey = await this.getMintPubkey();
		const result = await this.checkpointRepository.findOne({
			where: {module: 'cashu_mint', scope: mint_pubkey, data_type},
		});
		return result?.last_index ?? 0;
	}

	/**
	 * Saves the checkpoint for a specific data type.
	 *
	 * Checkpoints are always aligned to the start of an hour (UTC). This is
	 * a load-bearing invariant: the backfill buckets records by hour and uses
	 * `upsert` with REPLACE semantics on (keyset, unit, metric, hour). If a
	 * checkpoint ever landed mid-hour, a resume or rescan would refetch only
	 * the post-checkpoint portion of that hour and silently overwrite the
	 * previously-complete total with a partial one. Aligning to hour-start
	 * guarantees any resumed run re-fetches the entire hour and writes a
	 * complete replacement.
	 */
	private async saveCheckpoint(data_type: CheckpointDataType, timestamp: number): Promise<void> {
		const mint_pubkey = await this.getMintPubkey();
		const aligned_ts = timestamp > 0 ? DateTime.fromSeconds(timestamp, {zone: 'UTC'}).startOf('hour').toUnixInteger() : timestamp;
		await this.checkpointRepository.upsert(
			{
				module: 'cashu_mint',
				scope: mint_pubkey,
				data_type,
				last_index: aligned_ts,
				updated_at: DateTime.utc().toUnixInteger(),
			},
			['module', 'scope', 'data_type'],
		);
	}

	/* *******************************************************
		Helpers
	******************************************************** */

	/** Gets the mint pubkey from config, falling back to mint API */
	private async getMintPubkey(): Promise<string> {
		if (this.mint_pubkey) return this.mint_pubkey;
		const info = await this.cashuMintApiService.getMintInfo();
		if (!info.pubkey) {
			throw new Error('Could not get mint pubkey from mint info');
		}
		this.mint_pubkey = info.pubkey;
		return this.mint_pubkey;
	}

	/** Upserts an analytics metric row */
	private async upsertMetric(params: {
		mint_pubkey: string;
		keyset_id: string;
		unit: string;
		metric: MintAnalyticsMetric;
		hour: number;
		amount: bigint;
		count: number;
	}): Promise<void> {
		if (params.amount <= BigInt(0) && params.count <= 0) return;

		await this.mintAnalyticsRepository.upsert(
			{
				mint_pubkey: params.mint_pubkey,
				keyset_id: params.keyset_id,
				unit: params.unit,
				metric: params.metric,
				date: params.hour,
				amount: params.amount.toString(),
				count: params.count,
				updated_at: DateTime.utc().toUnixInteger(),
			},
			{conflictPaths: ['mint_pubkey', 'keyset_id', 'unit', 'metric', 'date']},
		);
	}

	/** Groups items by unit string */
	private groupByUnit<T>(items: T[], getUnit: (item: T) => string): [string, T[]][] {
		const map: Record<string, T[]> = {};
		for (const item of items) {
			const unit = getUnit(item) || 'sat';
			if (!map[unit]) map[unit] = [];
			map[unit].push(item);
		}
		return Object.entries(map);
	}

	/** Groups items by composite keyset_id|unit key */
	private groupByKeysetAndUnit<T>(items: T[], getKeyset: (item: T) => string, getUnit: (item: T) => string): [string, T[]][] {
		const map: Record<string, T[]> = {};
		for (const item of items) {
			const key = `${getKeyset(item)}|${getUnit(item) || 'sat'}`;
			if (!map[key]) map[key] = [];
			map[key].push(item);
		}
		return Object.entries(map);
	}

	/** Records a processed hour, seeding first_processed_at on the first call */
	private recordProcessedHour(hour: number): void {
		if (this.backfill_status.first_processed_at == null) this.backfill_status.first_processed_at = hour;
		this.backfill_status.last_processed_at = hour;
	}

	/** Flushes all remaining buckets */
	private async flushBuckets<T>(bucket: Map<number, T[]>, inserter: (hour: number, records: T[]) => Promise<void>): Promise<void> {
		for (const [hour, records] of Array.from(bucket).sort(([a], [b]) => a - b)) {
			await inserter(hour, records);
			this.recordProcessedHour(hour);
		}
		bucket.clear();
	}

	/** Force-flushes oldest hours when memory limit is exceeded */
	private async forceFlushIfNeeded<T>(bucket: Map<number, T[]>, inserter: (hour: number, records: T[]) => Promise<void>): Promise<void> {
		const total_pending = Array.from(bucket.values()).reduce((sum, arr) => sum + arr.length, 0);
		if (total_pending <= MAX_PENDING_RECORDS) return;

		this.logger.warn(`Pending bucket exceeded ${MAX_PENDING_RECORDS}, force-flushing oldest hours`);
		const oldest_hours = Array.from(bucket.keys())
			.sort((a, b) => a - b)
			.slice(0, FORCE_FLUSH_COUNT);
		for (const hour of oldest_hours) {
			await inserter(hour, bucket.get(hour)!);
			bucket.delete(hour);
			this.recordProcessedHour(hour);
		}
	}
}
