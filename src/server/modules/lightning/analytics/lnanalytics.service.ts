/* Core Dependencies */
import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository, DataSource, EntityManager, Between, In} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {AnalyticsCheckpoint} from '#server/modules/analytics/analytics-checkpoint.entity';
import type {
	LightningPayment,
	LightningInvoice,
	LightningForward,
	LightningChannel,
	LightningClosedChannel,
	LightningTransaction,
} from '#server/modules/lightning/lightning/lightning.types';
import {LightningChannelOpenInitiator} from '#server/modules/lightning/lightning.enums';
import type {AnalyticsBackfillStatus} from '#server/modules/analytics/analytics.interfaces';
/* Local Dependencies */
import {LightningAnalytics} from './lnanalytics.entity.js';
import {LightningAnalyticsMetric} from './lnanalytics.enums.js';

const BATCH_SIZE = 500;
const BATCH_DELAY_MS = 5000;
const MAX_PENDING_RECORDS = 100_000;
const FORCE_FLUSH_COUNT = 10;
const RESCAN_RECORDS = 1000;

@Injectable()
export class LightningAnalyticsService implements OnApplicationBootstrap {
	private readonly logger = new Logger(LightningAnalyticsService.name);
	private backfill_status: AnalyticsBackfillStatus = {is_running: false};
	private node_pubkey: string | null = null;

	constructor(
		@InjectRepository(LightningAnalytics)
		private lightningAnalyticsRepository: Repository<LightningAnalytics>,
		@InjectRepository(AnalyticsCheckpoint)
		private checkpointRepository: Repository<AnalyticsCheckpoint>,
		private dataSource: DataSource,
		private lightningService: LightningService,
		private bitcoinRpcService: BitcoinRpcService,
	) {}

	async onApplicationBootstrap() {
		if (process.env.SCHEMA_ONLY) return;
		if (!this.lightningService.isConfigured()) {
			this.logger.log('Lightning not configured, skipping auto-backfill');
			return;
		}

		this.runStreamingBackfill().catch((error) => {
			this.logger.error('Error during lightning analytics auto-backfill', error);
		});
	}

	/**
	 * Gets the current node's public key, caching it for subsequent calls
	 */
	private async getNodePubkey(): Promise<string> {
		if (this.node_pubkey) return this.node_pubkey;
		const info = await this.lightningService.getLightningInfo();
		if (!info.identity_pubkey) {
			throw new Error('Could not get node pubkey from lightning info');
		}
		this.node_pubkey = info.identity_pubkey;
		return this.node_pubkey;
	}

	/**
	 * Gets the last cached hour timestamp for the current node
	 */
	async getLastCachedHour(): Promise<number | null> {
		const node_pubkey = await this.getNodePubkey();
		const result = await this.lightningAnalyticsRepository.findOne({
			where: {node_pubkey},
			order: {date: 'DESC'},
		});
		return result ? result.date : null;
	}

	/**
	 * Gets cached analytics for a date range
	 * @param group_key - null for BTC, string for Taproot Assets, undefined for all
	 */
	async getCachedAnalytics(
		date_start: number,
		date_end: number,
		metrics: LightningAnalyticsMetric[],
		group_key?: string | null,
	): Promise<LightningAnalytics[]> {
		if (date_end < date_start) return [];

		const node_pubkey = await this.getNodePubkey();
		const start_hour = DateTime.fromSeconds(date_start, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		const end_hour = DateTime.fromSeconds(date_end, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		const where: any = {
			node_pubkey,
			date: Between(start_hour, end_hour),
			metric: In(metrics),
		};

		// Handle group_key filtering: null = BTC only (empty string in DB), string = specific asset, undefined = all
		if (group_key === null) {
			where.group_key = '';
		} else if (group_key !== undefined) {
			where.group_key = group_key;
		}

		return this.lightningAnalyticsRepository.find({
			where,
			order: {date: 'ASC'},
		});
	}

	/**
	 * Gets the current backfill status
	 */
	getBackfillStatus(): AnalyticsBackfillStatus {
		return {...this.backfill_status};
	}

	/**
	 * Checks if there's any cached data for the current node
	 */
	async hasAnyCachedData(): Promise<boolean> {
		const node_pubkey = await this.getNodePubkey();
		const count = await this.lightningAnalyticsRepository.count({where: {node_pubkey}});
		return count > 0;
	}

	/**
	 * Sums payments by status for a specific group_key (null = BTC only)
	 * @param {LightningPayment[]} payments - All payments in the bucket
	 * @param {string} status - Payment status to filter by ('succeeded', 'failed', 'pending')
	 * @param {string | null} group_key - null for BTC, string for asset group
	 * @param {Map<string, string>} asset_to_group - Asset ID to group key mapping
	 * @param {boolean} include_fees - Whether to include fee_msat in BTC sum (only for succeeded)
	 */
	private sumPaymentsByStatus(
		payments: LightningPayment[],
		status: string,
		group_key: string | null,
		asset_to_group: Map<string, string>,
		include_fees: boolean = false,
	): bigint {
		const filtered = payments.filter((p) => p.status === status);

		if (group_key === null) {
			return filtered
				.filter((p) => p.asset_balances.length === 0)
				.reduce((sum, p) => sum + BigInt(p.value_msat) + (include_fees ? BigInt(p.fee_msat) : BigInt(0)), BigInt(0));
		}

		return filtered
			.flatMap((p) => p.asset_balances)
			.filter((ab) => asset_to_group.get(ab.asset_id) === group_key)
			.reduce((sum, ab) => sum + BigInt(ab.amount), BigInt(0));
	}

	/**
	 * Sums incoming invoices for a specific group_key (null = BTC only)
	 */
	private sumInvoicesIn(invoices: LightningInvoice[], group_key: string | null, asset_to_group: Map<string, string>): bigint {
		const settled = invoices.filter((i) => i.state === 'settled');

		if (group_key === null) {
			return settled.filter((i) => i.asset_balances.length === 0).reduce((sum, i) => sum + BigInt(i.amt_paid_msat), BigInt(0));
		}

		return settled
			.flatMap((i) => i.asset_balances)
			.filter((ab) => asset_to_group.get(ab.asset_id) === group_key)
			.reduce((sum, ab) => sum + BigInt(ab.amount), BigInt(0));
	}

	private sumForwardFees(forwards: LightningForward[]): bigint {
		return forwards.reduce((sum, f) => sum + BigInt(f.fee_msat), BigInt(0));
	}

	/**
	 * Counts payments by status for a specific group_key (null = BTC only)
	 */
	private countPaymentsByStatus(
		payments: LightningPayment[],
		status: string,
		group_key: string | null,
		asset_to_group: Map<string, string>,
	): number {
		const filtered = payments.filter((p) => p.status === status);

		if (group_key === null) {
			return filtered.filter((p) => p.asset_balances.length === 0).length;
		}

		return filtered.flatMap((p) => p.asset_balances).filter((ab) => asset_to_group.get(ab.asset_id) === group_key).length;
	}

	/**
	 * Counts settled invoices for a specific group_key (null = BTC only)
	 */
	private countInvoicesIn(invoices: LightningInvoice[], group_key: string | null, asset_to_group: Map<string, string>): number {
		const settled = invoices.filter((i) => i.state === 'settled');

		if (group_key === null) {
			return settled.filter((i) => i.asset_balances.length === 0).length;
		}

		return settled.flatMap((i) => i.asset_balances).filter((ab) => asset_to_group.get(ab.asset_id) === group_key).length;
	}

	/**
	 * Converts satoshis to millisatoshis
	 */
	private satToMsat(sats: number | string): bigint {
		return BigInt(sats) * BigInt(1000);
	}

	/**
	 * Computes the initial local balance when a channel was opened
	 */
	private computeInitialLocalBalance(channel: LightningChannel | LightningClosedChannel): bigint {
		const capacity_msat = this.satToMsat(channel.capacity);

		// LightningChannel with known initiator
		if ('initiator' in channel && channel.initiator !== null) {
			const push_msat = channel.push_amount_sat ? this.satToMsat(channel.push_amount_sat) : BigInt(0);
			return channel.initiator ? capacity_msat - push_msat : push_msat;
		}

		// LightningClosedChannel with known initiator
		if ('open_initiator' in channel) {
			const {open_initiator} = channel as LightningClosedChannel;
			if (open_initiator === LightningChannelOpenInitiator.LOCAL) return capacity_msat;
			if (open_initiator === LightningChannelOpenInitiator.REMOTE) return BigInt(0);
		}

		// Fallback: use current/settled balance as approximation
		if ('local_balance' in channel) return this.satToMsat((channel as LightningChannel).local_balance);
		if ('settled_balance' in channel) return this.satToMsat((channel as LightningClosedChannel).settled_balance);

		return BigInt(0);
	}

	/**
	 * Computes the initial remote balance when a channel was opened
	 */
	private computeInitialRemoteBalance(channel: LightningChannel | LightningClosedChannel): bigint {
		const capacity_msat = this.satToMsat(channel.capacity);
		return capacity_msat - this.computeInitialLocalBalance(channel);
	}

	private buildTxTimestampMap(transactions: LightningTransaction[]): Map<string, number> {
		return new Map(transactions.filter((tx) => tx.tx_hash && tx.time_stamp > 0).map((tx) => [tx.tx_hash, tx.time_stamp]));
	}

	/**
	 * Builds a map from asset_id to group_key using channel data
	 */
	private buildAssetToGroupKeyMap(channels: LightningChannel[], closed_channels: LightningClosedChannel[]): Map<string, string> {
		return new Map([...channels, ...closed_channels].filter((c) => c.asset).map((c) => [c.asset!.asset_id, c.asset!.group_key]));
	}

	/**
	 * Builds a map from group_key to asset name using channel data
	 * Prioritizes open channels (more likely to have full asset genesis data)
	 */
	private buildGroupKeyToNameMap(channels: LightningChannel[], closed_channels: LightningClosedChannel[]): Map<string, string> {
		return new Map(
			[...closed_channels, ...channels]
				.filter((c) => c.asset?.group_key && c.asset.name)
				.map((c) => [c.asset!.group_key, c.asset!.name]),
		);
	}

	/**
	 * Upserts an analytics metric if amount > 0 or count > 0
	 */
	private async upsertMetric(
		repo: Repository<LightningAnalytics>,
		params: {
			node_pubkey: string;
			group_key: string;
			unit: string;
			metric: LightningAnalyticsMetric;
			hour: number;
			amount: bigint;
			count: number;
		},
	): Promise<void> {
		if (params.amount <= BigInt(0) && params.count <= 0) return;

		await repo.upsert(
			{
				node_pubkey: params.node_pubkey,
				group_key: params.group_key,
				unit: params.unit,
				metric: params.metric,
				date: params.hour,
				amount: params.amount.toString(),
				count: params.count,
				updated_at: DateTime.utc().toUnixInteger(),
			},
			{conflictPaths: ['node_pubkey', 'group_key', 'unit', 'metric', 'date']},
		);
	}

	/* ============================================
	   Streaming Backfill Methods
	   ============================================ */

	/**
	 * Gets the checkpoint for a specific data type
	 */
	async getCheckpoint(data_type: string): Promise<number> {
		const node_pubkey = await this.getNodePubkey();
		const result = await this.checkpointRepository.findOne({
			where: {module: 'lightning', scope: node_pubkey, data_type},
		});
		return result?.last_index ?? 0;
	}

	/**
	 * Saves the checkpoint for a specific data type
	 */
	private async saveCheckpoint(data_type: string, index: number): Promise<void> {
		const node_pubkey = await this.getNodePubkey();
		await this.checkpointRepository.upsert(
			{
				module: 'lightning',
				scope: node_pubkey,
				data_type,
				last_index: index,
				updated_at: DateTime.utc().toUnixInteger(),
			},
			['module', 'scope', 'data_type'],
		);
	}

	/** Records a processed hour, seeding first_processed_at on the first call */
	private recordProcessedHour(hour: number): void {
		if (this.backfill_status.first_processed_at == null) this.backfill_status.first_processed_at = hour;
		this.backfill_status.last_processed_at = hour;
	}

	/**
	 * Runs the streaming backfill - fetches data in batches, buckets by hour, inserts when complete
	 */
	async runStreamingBackfill(): Promise<void> {
		if (this.backfill_status.is_running) {
			this.logger.warn('Backfill already running');
			return;
		}

		this.backfill_status = {is_running: true, total_streams: 3, streams_completed: 0, errors: 0};
		this.logger.log('Starting lightning analytics backfill');

		try {
			await this.getNodePubkey().catch(() => null);
			if (!this.node_pubkey) {
				this.logger.warn('Lightning node not reachable, skipping lightning analytics backfill');
				return;
			}

			const current_hour = DateTime.utc().startOf('hour').toUnixInteger();

			// Fetch static data once
			const [channels, closed_channels, transactions] = await Promise.all([
				this.lightningService.getChannels(),
				this.lightningService.getClosedChannels(),
				this.lightningService.getTransactions(),
			]);
			const tx_timestamps = this.buildTxTimestampMap(transactions);

			// Stream and bucket each data type
			await this.streamAndBucketPayments(current_hour, channels, closed_channels);
			this.backfill_status.streams_completed++;
			await this.streamAndBucketInvoices(current_hour, channels, closed_channels);
			this.backfill_status.streams_completed++;
			await this.streamAndBucketForwards(current_hour, channels, closed_channels);
			this.backfill_status.streams_completed++;

			// Handle channel opens/closes
			await this.backfillChannelMetrics(channels, closed_channels, tx_timestamps, current_hour);

			this.logger.log('Lightning analytics backfill complete');
		} catch (error) {
			this.logger.error('Lightning analytics backfill error', error);
			this.backfill_status.errors++;
		} finally {
			this.backfill_status.is_running = false;
		}
	}

	/**
	 * Streams payments and buckets them by hour
	 */
	private async streamAndBucketPayments(
		current_hour: number,
		channels: LightningChannel[],
		closed_channels: LightningClosedChannel[],
	): Promise<void> {
		let offset = await this.getCheckpoint('payments');
		const pending_bucket: Map<number, LightningPayment[]> = new Map();
		const asset_to_group = this.buildAssetToGroupKeyMap(channels, closed_channels);
		const group_to_name = this.buildGroupKeyToNameMap(channels, closed_channels);

		while (true) {
			const result = await this.lightningService.getPayments({index_offset: offset, max_results: BATCH_SIZE});
			const batch = result.data;

			if (batch.length === 0) {
				await this.flushPaymentBuckets(pending_bucket, asset_to_group, group_to_name);
				break;
			}

			// Bucket by hour
			for (const payment of batch) {
				const hour = DateTime.fromSeconds(payment.creation_time, {zone: 'UTC'}).startOf('hour').toUnixInteger();
				if (hour >= current_hour) continue;

				if (!pending_bucket.has(hour)) pending_bucket.set(hour, []);
				pending_bucket.get(hour)!.push(payment);
			}

			// Use MIN timestamp for safe flush boundary (avoid race condition)
			let min_timestamp = Infinity;
			for (const payment of batch) {
				min_timestamp = Math.min(min_timestamp, payment.creation_time);
			}
			const safe_boundary = DateTime.fromSeconds(min_timestamp, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			const complete_hours = Array.from(pending_bucket.keys()).filter((h) => h < safe_boundary);

			// Flush complete hours within transaction
			if (complete_hours.length > 0) {
				await this.dataSource.transaction(async (manager) => {
					for (const hour of complete_hours.sort((a, b) => a - b)) {
						await this.insertPaymentMetrics(manager, hour, pending_bucket.get(hour)!, asset_to_group, group_to_name);
						pending_bucket.delete(hour);
						this.recordProcessedHour(hour);
					}
				});
			}

			// Memory safeguard
			const total_pending = Array.from(pending_bucket.values()).reduce((sum, arr) => sum + arr.length, 0);
			if (total_pending > MAX_PENDING_RECORDS) {
				this.logger.warn(`Pending bucket exceeded ${MAX_PENDING_RECORDS}, force-flushing oldest hours`);
				await this.forceFlushOldestHours(pending_bucket, asset_to_group, group_to_name, 'payments');
			}

			offset = result.last_offset;

			if (batch.length < BATCH_SIZE) {
				await this.flushPaymentBuckets(pending_bucket, asset_to_group, group_to_name);
				await this.saveCheckpoint('payments', offset);
				break;
			}

			// Save checkpoint after each full batch
			await this.saveCheckpoint('payments', offset);
			await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
		}
	}

	/**
	 * Streams invoices and buckets them by settle_date (not creation_date)
	 */
	private async streamAndBucketInvoices(
		current_hour: number,
		channels: LightningChannel[],
		closed_channels: LightningClosedChannel[],
	): Promise<void> {
		let offset = await this.getCheckpoint('invoices');
		const pending_bucket: Map<number, LightningInvoice[]> = new Map();
		const asset_to_group = this.buildAssetToGroupKeyMap(channels, closed_channels);
		const group_to_name = this.buildGroupKeyToNameMap(channels, closed_channels);

		while (true) {
			const result = await this.lightningService.getInvoices({index_offset: offset, max_results: BATCH_SIZE});
			const batch = result.data;

			if (batch.length === 0) {
				await this.flushInvoiceBuckets(pending_bucket, asset_to_group, group_to_name);
				break;
			}

			// Bucket by settle_date (when payment was received), not creation_date
			for (const invoice of batch) {
				if (invoice.state !== 'settled' || !invoice.settle_date) continue;
				const hour = DateTime.fromSeconds(invoice.settle_date, {zone: 'UTC'}).startOf('hour').toUnixInteger();
				if (hour >= current_hour) continue;

				if (!pending_bucket.has(hour)) pending_bucket.set(hour, []);
				pending_bucket.get(hour)!.push(invoice);
			}

			// Use MIN settle_date for safe flush boundary
			let min_timestamp = Infinity;
			for (const invoice of batch) {
				if (invoice.settle_date) min_timestamp = Math.min(min_timestamp, invoice.settle_date);
			}
			const safe_boundary =
				min_timestamp === Infinity
					? current_hour
					: DateTime.fromSeconds(min_timestamp, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			const complete_hours = Array.from(pending_bucket.keys()).filter((h) => h < safe_boundary);

			if (complete_hours.length > 0) {
				await this.dataSource.transaction(async (manager) => {
					for (const hour of complete_hours.sort((a, b) => a - b)) {
						await this.insertInvoiceMetrics(manager, hour, pending_bucket.get(hour)!, asset_to_group, group_to_name);
						pending_bucket.delete(hour);
						this.recordProcessedHour(hour);
					}
				});
			}

			// Memory safeguard
			const total_pending = Array.from(pending_bucket.values()).reduce((sum, arr) => sum + arr.length, 0);
			if (total_pending > MAX_PENDING_RECORDS) {
				this.logger.warn(`Pending bucket exceeded ${MAX_PENDING_RECORDS}, force-flushing oldest hours`);
				await this.forceFlushOldestHours(pending_bucket, asset_to_group, group_to_name, 'invoices');
			}

			offset = result.last_offset;

			if (batch.length < BATCH_SIZE) {
				await this.flushInvoiceBuckets(pending_bucket, asset_to_group, group_to_name);
				await this.saveCheckpoint('invoices', offset);
				break;
			}

			await this.saveCheckpoint('invoices', offset);
			await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
		}
	}

	/**
	 * Streams forwards and buckets them by hour
	 */
	private async streamAndBucketForwards(
		current_hour: number,
		_channels: LightningChannel[],
		_closed_channels: LightningClosedChannel[],
	): Promise<void> {
		let offset = await this.getCheckpoint('forwards');
		const pending_bucket: Map<number, LightningForward[]> = new Map();

		while (true) {
			const result = await this.lightningService.getForwards({index_offset: offset, max_results: BATCH_SIZE});
			const batch = result.data;

			if (batch.length === 0) {
				await this.flushForwardBuckets(pending_bucket);
				break;
			}

			// Bucket by timestamp
			for (const forward of batch) {
				const hour = DateTime.fromSeconds(forward.timestamp, {zone: 'UTC'}).startOf('hour').toUnixInteger();
				if (hour >= current_hour) continue;

				if (!pending_bucket.has(hour)) pending_bucket.set(hour, []);
				pending_bucket.get(hour)!.push(forward);
			}

			// Use MIN timestamp for safe flush boundary
			let min_timestamp = Infinity;
			for (const forward of batch) {
				min_timestamp = Math.min(min_timestamp, forward.timestamp);
			}
			const safe_boundary = DateTime.fromSeconds(min_timestamp, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			const complete_hours = Array.from(pending_bucket.keys()).filter((h) => h < safe_boundary);

			if (complete_hours.length > 0) {
				await this.dataSource.transaction(async (manager) => {
					for (const hour of complete_hours.sort((a, b) => a - b)) {
						await this.insertForwardMetrics(manager, hour, pending_bucket.get(hour)!);
						pending_bucket.delete(hour);
						this.recordProcessedHour(hour);
					}
				});
			}

			// Memory safeguard
			const total_pending = Array.from(pending_bucket.values()).reduce((sum, arr) => sum + arr.length, 0);
			if (total_pending > MAX_PENDING_RECORDS) {
				this.logger.warn(`Pending bucket exceeded ${MAX_PENDING_RECORDS}, force-flushing oldest hours`);
				const oldest_hours = Array.from(pending_bucket.keys())
					.sort((a, b) => a - b)
					.slice(0, FORCE_FLUSH_COUNT);
				for (const hour of oldest_hours) {
					await this.insertForwardMetrics(null, hour, pending_bucket.get(hour)!);
					pending_bucket.delete(hour);
				}
			}

			offset = result.last_offset;

			if (batch.length < BATCH_SIZE) {
				await this.flushForwardBuckets(pending_bucket);
				await this.saveCheckpoint('forwards', offset);
				break;
			}

			await this.saveCheckpoint('forwards', offset);
			await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
		}
	}

	/**
	 * Flushes all remaining payment buckets
	 */
	private async flushPaymentBuckets(
		pending_bucket: Map<number, LightningPayment[]>,
		asset_to_group: Map<string, string>,
		group_to_name: Map<string, string>,
	): Promise<void> {
		for (const [hour, payments] of Array.from(pending_bucket)) {
			await this.insertPaymentMetrics(null, hour, payments, asset_to_group, group_to_name);
			this.recordProcessedHour(hour);
		}
		pending_bucket.clear();
	}

	/**
	 * Flushes all remaining invoice buckets
	 */
	private async flushInvoiceBuckets(
		pending_bucket: Map<number, LightningInvoice[]>,
		asset_to_group: Map<string, string>,
		group_to_name: Map<string, string>,
	): Promise<void> {
		for (const [hour, invoices] of Array.from(pending_bucket)) {
			await this.insertInvoiceMetrics(null, hour, invoices, asset_to_group, group_to_name);
			this.recordProcessedHour(hour);
		}
		pending_bucket.clear();
	}

	/**
	 * Flushes all remaining forward buckets
	 */
	private async flushForwardBuckets(pending_bucket: Map<number, LightningForward[]>): Promise<void> {
		for (const [hour, forwards] of Array.from(pending_bucket)) {
			await this.insertForwardMetrics(null, hour, forwards);
			this.recordProcessedHour(hour);
		}
		pending_bucket.clear();
	}

	/**
	 * Force flushes oldest hours when memory limit exceeded
	 */
	private async forceFlushOldestHours(
		pending_bucket: Map<number, LightningPayment[] | LightningInvoice[]>,
		asset_to_group: Map<string, string>,
		group_to_name: Map<string, string>,
		data_type: 'payments' | 'invoices',
	): Promise<void> {
		const oldest_hours = Array.from(pending_bucket.keys())
			.sort((a, b) => a - b)
			.slice(0, FORCE_FLUSH_COUNT);
		for (const hour of oldest_hours) {
			const records = pending_bucket.get(hour)!;
			if (data_type === 'payments') {
				await this.insertPaymentMetrics(null, hour, records as LightningPayment[], asset_to_group, group_to_name);
			} else {
				await this.insertInvoiceMetrics(null, hour, records as LightningInvoice[], asset_to_group, group_to_name);
			}
			pending_bucket.delete(hour);
		}
	}

	/**
	 * Inserts payment metrics for a specific hour
	 */
	private async insertPaymentMetrics(
		manager: EntityManager | null,
		hour: number,
		payments: LightningPayment[],
		asset_to_group: Map<string, string>,
		group_to_name: Map<string, string>,
	): Promise<void> {
		const node_pubkey = await this.getNodePubkey();
		const repo = manager ? manager.getRepository(LightningAnalytics) : this.lightningAnalyticsRepository;

		// BTC metrics
		const btc_metrics: {metric: LightningAnalyticsMetric; amount: bigint; count: number}[] = [
			{
				metric: LightningAnalyticsMetric.payments_out,
				amount: this.sumPaymentsByStatus(payments, 'succeeded', null, asset_to_group, true),
				count: this.countPaymentsByStatus(payments, 'succeeded', null, asset_to_group),
			},
			{
				metric: LightningAnalyticsMetric.payments_failed,
				amount: this.sumPaymentsByStatus(payments, 'failed', null, asset_to_group),
				count: this.countPaymentsByStatus(payments, 'failed', null, asset_to_group),
			},
			{
				metric: LightningAnalyticsMetric.payments_pending,
				amount: this.sumPaymentsByStatus(payments, 'pending', null, asset_to_group),
				count: this.countPaymentsByStatus(payments, 'pending', null, asset_to_group),
			},
		];
		for (const {metric, amount, count} of btc_metrics) {
			await this.upsertMetric(repo, {node_pubkey, group_key: '', unit: 'msat', metric, hour, amount, count});
		}

		// Asset metrics per group
		for (const group_key of Array.from(this.collectGroupKeys(payments, asset_to_group))) {
			const asset_metrics: {metric: LightningAnalyticsMetric; amount: bigint; count: number}[] = [
				{
					metric: LightningAnalyticsMetric.payments_out,
					amount: this.sumPaymentsByStatus(payments, 'succeeded', group_key, asset_to_group, true),
					count: this.countPaymentsByStatus(payments, 'succeeded', group_key, asset_to_group),
				},
				{
					metric: LightningAnalyticsMetric.payments_failed,
					amount: this.sumPaymentsByStatus(payments, 'failed', group_key, asset_to_group),
					count: this.countPaymentsByStatus(payments, 'failed', group_key, asset_to_group),
				},
				{
					metric: LightningAnalyticsMetric.payments_pending,
					amount: this.sumPaymentsByStatus(payments, 'pending', group_key, asset_to_group),
					count: this.countPaymentsByStatus(payments, 'pending', group_key, asset_to_group),
				},
			];
			for (const {metric, amount, count} of asset_metrics) {
				await this.upsertMetric(repo, {
					node_pubkey,
					group_key,
					unit: group_to_name.get(group_key) || group_key,
					metric,
					hour,
					amount,
					count,
				});
			}
		}
	}

	/**
	 * Inserts invoice metrics for a specific hour
	 */
	private async insertInvoiceMetrics(
		manager: EntityManager | null,
		hour: number,
		invoices: LightningInvoice[],
		asset_to_group: Map<string, string>,
		group_to_name: Map<string, string>,
	): Promise<void> {
		const node_pubkey = await this.getNodePubkey();
		const repo = manager ? manager.getRepository(LightningAnalytics) : this.lightningAnalyticsRepository;

		// BTC metrics
		await this.upsertMetric(repo, {
			node_pubkey,
			group_key: '',
			unit: 'msat',
			metric: LightningAnalyticsMetric.invoices_in,
			hour,
			amount: this.sumInvoicesIn(invoices, null, asset_to_group),
			count: this.countInvoicesIn(invoices, null, asset_to_group),
		});

		// Asset metrics per group
		for (const group_key of Array.from(this.collectGroupKeys(invoices, asset_to_group))) {
			await this.upsertMetric(repo, {
				node_pubkey,
				group_key,
				unit: group_to_name.get(group_key) || group_key,
				metric: LightningAnalyticsMetric.invoices_in,
				hour,
				amount: this.sumInvoicesIn(invoices, group_key, asset_to_group),
				count: this.countInvoicesIn(invoices, group_key, asset_to_group),
			});
		}
	}

	/**
	 * Inserts forward fee metrics for a specific hour
	 */
	private async insertForwardMetrics(manager: EntityManager | null, hour: number, forwards: LightningForward[]): Promise<void> {
		const node_pubkey = await this.getNodePubkey();
		const repo = manager ? manager.getRepository(LightningAnalytics) : this.lightningAnalyticsRepository;

		await this.upsertMetric(repo, {
			node_pubkey,
			group_key: '',
			unit: 'msat',
			metric: LightningAnalyticsMetric.forward_fees,
			hour,
			amount: this.sumForwardFees(forwards),
			count: forwards.length,
		});
	}

	/**
	 * Gets transaction timestamp from map or falls back to Bitcoin RPC
	 * Useful for remote-opened channels where the funding tx isn't in our wallet
	 */
	private async getTxTimestamp(txid: string, tx_timestamps: Map<string, number>): Promise<number | null> {
		const cached = tx_timestamps.get(txid);
		if (cached) return cached;

		if (this.bitcoinRpcService.isConfigured()) {
			try {
				const tx = await this.bitcoinRpcService.getTransaction(txid);
				if (tx?.blocktime) {
					tx_timestamps.set(txid, tx.blocktime);
					return tx.blocktime;
				}
			} catch {
				// Transaction not found or RPC error
			}
		}
		return null;
	}

	/**
	 * Backfills channel open/close metrics using transaction timestamps
	 * Handles both BTC and Taproot Asset channels
	 * Falls back to Bitcoin RPC for remote-opened channels not in our wallet
	 */
	private async backfillChannelMetrics(
		channels: LightningChannel[],
		closed_channels: LightningClosedChannel[],
		tx_timestamps: Map<string, number>,
		current_hour: number,
	): Promise<void> {
		const node_pubkey = await this.getNodePubkey();
		const group_to_name = this.buildGroupKeyToNameMap(channels, closed_channels);

		// Aggregate metrics: Map<hour, Map<group_key, {amount, count}>>
		type Bucket = {amount: bigint; count: number};
		const opens_by_hour: Map<number, Map<string, Bucket>> = new Map();
		const closes_by_hour: Map<number, Map<string, Bucket>> = new Map();
		const opens_remote_by_hour: Map<number, Map<string, Bucket>> = new Map();
		const closes_remote_by_hour: Map<number, Map<string, Bucket>> = new Map();

		// Helper to accumulate into nested map
		const accumulate = (map: Map<number, Map<string, Bucket>>, hour: number, group_key: string, amount: bigint) => {
			if (!map.has(hour)) map.set(hour, new Map());
			const group_map = map.get(hour)!;
			const existing = group_map.get(group_key);
			group_map.set(group_key, {
				amount: (existing?.amount ?? BigInt(0)) + amount,
				count: (existing?.count ?? 0) + 1,
			});
		};

		// Process channel opens (both open and closed channels had an open event)
		for (const channel of [...channels, ...closed_channels]) {
			const timestamp = await this.getTxTimestamp(channel.funding_txid, tx_timestamps);
			if (!timestamp) continue;
			const hour = DateTime.fromSeconds(timestamp, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			if (hour >= current_hour) continue;

			// BTC balance (empty string = BTC group_key)
			accumulate(opens_by_hour, hour, '', this.computeInitialLocalBalance(channel));
			accumulate(opens_remote_by_hour, hour, '', this.computeInitialRemoteBalance(channel));

			// Asset balance (only for Taproot Asset channels)
			if (channel.asset?.group_key) {
				accumulate(opens_by_hour, hour, channel.asset.group_key, BigInt(channel.asset.local_balance));
				accumulate(opens_remote_by_hour, hour, channel.asset.group_key, BigInt(channel.asset.remote_balance));
			}
		}

		// Process channel closes
		for (const channel of closed_channels) {
			const timestamp = await this.getTxTimestamp(channel.closing_txid, tx_timestamps);
			if (!timestamp) continue;
			const hour = DateTime.fromSeconds(timestamp, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			if (hour >= current_hour) continue;

			// BTC balance
			accumulate(closes_by_hour, hour, '', this.satToMsat(channel.settled_balance));
			const remote_close = this.satToMsat(channel.capacity) - this.satToMsat(channel.settled_balance);
			accumulate(closes_remote_by_hour, hour, '', remote_close);

			// Asset balance
			if (channel.asset?.group_key) {
				accumulate(closes_by_hour, hour, channel.asset.group_key, BigInt(channel.asset.local_balance));
				accumulate(
					closes_remote_by_hour,
					hour,
					channel.asset.group_key,
					BigInt(channel.asset.capacity) - BigInt(channel.asset.local_balance),
				);
			}
		}

		// Insert all metrics
		const insert_metrics = async (metrics_map: Map<number, Map<string, Bucket>>, metric: LightningAnalyticsMetric) => {
			for (const [hour, group_map] of Array.from(metrics_map.entries())) {
				for (const [group_key, {amount, count}] of Array.from(group_map.entries())) {
					await this.upsertMetric(this.lightningAnalyticsRepository, {
						node_pubkey,
						group_key,
						unit: group_key === '' ? 'msat' : group_to_name.get(group_key) || group_key,
						metric,
						hour,
						amount,
						count,
					});
				}
			}
		};

		await insert_metrics(opens_by_hour, LightningAnalyticsMetric.channel_opens);
		await insert_metrics(closes_by_hour, LightningAnalyticsMetric.channel_closes);
		await insert_metrics(opens_remote_by_hour, LightningAnalyticsMetric.channel_opens_remote);
		await insert_metrics(closes_remote_by_hour, LightningAnalyticsMetric.channel_closes_remote);
	}

	/**
	 * Collects unique group keys from items with asset_balances
	 */
	private collectGroupKeys<T extends {asset_balances: {asset_id: string}[]}>(
		items: T[],
		asset_to_group: Map<string, string>,
	): Set<string> {
		const keys = new Set<string>();
		for (const item of items) {
			for (const ab of item.asset_balances) {
				const gk = asset_to_group.get(ab.asset_id);
				if (gk) keys.add(gk);
			}
		}
		return keys;
	}

	/**
	 * Re-scans recent records to catch pending invoices/payments that have since settled.
	 * Resets checkpoints back by RESCAN_RECORDS to re-process recent data.
	 * Call this daily to catch any lagging settlements.
	 */
	async rescanRecentRecords(): Promise<void> {
		if (this.backfill_status.is_running) {
			this.logger.warn('Backfill already running, skipping rescan');
			return;
		}
		this.logger.log(`Resetting checkpoints to re-scan last ${RESCAN_RECORDS} records`);
		const payments_checkpoint = await this.getCheckpoint('payments');
		const invoices_checkpoint = await this.getCheckpoint('invoices');
		const forwards_checkpoint = await this.getCheckpoint('forwards');
		await this.saveCheckpoint('payments', Math.max(0, payments_checkpoint - RESCAN_RECORDS));
		await this.saveCheckpoint('invoices', Math.max(0, invoices_checkpoint - RESCAN_RECORDS));
		await this.saveCheckpoint('forwards', Math.max(0, forwards_checkpoint - RESCAN_RECORDS));
		await this.runStreamingBackfill();
	}
}
