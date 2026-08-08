/* Core Dependencies */
import {Injectable, Logger, OnApplicationBootstrap} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository, Between, In, FindOptionsWhere} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {TaprootAssetsService} from '#server/modules/tapass/tapass/tapass.service';
import {AnalyticsCheckpoint} from '#server/modules/analytics/analytics-checkpoint.entity';
import type {LightningTransaction} from '#server/modules/lightning/lightning/lightning.types';
import type {AssetTransfer, AddrEvent, TaprootAsset} from '#server/modules/tapass/tapass/tapass.types';
import type {AnalyticsBackfillStatus} from '#server/modules/analytics/analytics.interfaces';
/* Local Dependencies */
import {BitcoinAnalytics} from './btcanalytics.entity.js';
import {BitcoinAnalyticsMetric} from './btcanalytics.enums.js';
import type {AssetInfoMap} from './btcanalytics.interfaces.js';

const RESCAN_SECONDS = 86400 * 7; // Re-scan last 7 days on daily rescan

@Injectable()
export class BitcoinAnalyticsService implements OnApplicationBootstrap {
	private readonly logger = new Logger(BitcoinAnalyticsService.name);
	private backfill_status: AnalyticsBackfillStatus = {is_running: false};
	private node_pubkey: string | null = null;

	constructor(
		@InjectRepository(BitcoinAnalytics)
		private bitcoinAnalyticsRepository: Repository<BitcoinAnalytics>,
		@InjectRepository(AnalyticsCheckpoint)
		private checkpointRepository: Repository<AnalyticsCheckpoint>,
		private lightningService: LightningService,
		private taprootAssetsService: TaprootAssetsService,
	) {}

	async onApplicationBootstrap() {
		if (process.env.SCHEMA_ONLY) return;
		if (!this.lightningService.isConfigured()) {
			this.logger.log('Lightning not configured, skipping bitcoin analytics auto-backfill');
			return;
		}

		this.runStreamingBackfill().catch((error) => {
			this.logger.error('Error during bitcoin analytics auto-backfill', error);
		});
	}

	/* *******************************************************
		Node Identity
	******************************************************** */

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

	/* *******************************************************
		Query Methods
	******************************************************** */

	/**
	 * Gets cached analytics for a date range
	 * @param group_key - null for BTC, string for Taproot Assets, undefined for all
	 */
	async getCachedAnalytics(
		date_start: number,
		date_end: number,
		metrics: BitcoinAnalyticsMetric[],
		group_key?: string | null,
	): Promise<BitcoinAnalytics[]> {
		if (date_end < date_start) return [];

		const node_pubkey = await this.getNodePubkey();
		const start_hour = DateTime.fromSeconds(date_start, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		const end_hour = DateTime.fromSeconds(date_end, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		const where: FindOptionsWhere<BitcoinAnalytics> = {
			node_pubkey,
			date: Between(start_hour, end_hour),
			metric: In(metrics),
			...(group_key === null ? {group_key: ''} : group_key !== undefined ? {group_key} : {}),
		};

		return this.bitcoinAnalyticsRepository.find({
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

	/* *******************************************************
		Checkpoint Management
	******************************************************** */

	/**
	 * Gets the checkpoint for a specific data type
	 */
	private async getCheckpoint(data_type: string): Promise<number> {
		const node_pubkey = await this.getNodePubkey();
		const result = await this.checkpointRepository.findOne({
			where: {module: 'bitcoin', scope: node_pubkey, data_type},
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
				module: 'bitcoin',
				scope: node_pubkey,
				data_type,
				last_index: index,
				updated_at: DateTime.utc().toUnixInteger(),
			},
			['module', 'scope', 'data_type'],
		);
	}

	/* *******************************************************
		Upsert Helper
	******************************************************** */

	/**
	 * Upserts an analytics metric if amount > 0 or count > 0
	 */
	private async upsertMetric(params: {
		node_pubkey: string;
		group_key: string;
		unit: string;
		metric: BitcoinAnalyticsMetric;
		hour: number;
		amount: bigint;
		count: number;
	}): Promise<void> {
		if (params.amount <= BigInt(0) && params.count <= 0) return;

		await this.bitcoinAnalyticsRepository.upsert(
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

	/* *******************************************************
		Taproot Asset Helpers
	******************************************************** */

	/**
	 * Builds a map from asset_id (hex) to {group_key, unit} using ListAssets
	 */
	private buildAssetInfoMap(assets: TaprootAsset[]): AssetInfoMap {
		const map: AssetInfoMap = new Map();
		for (const asset of assets) {
			const asset_id = asset.asset_genesis.asset_id.toString('hex');
			const group_key = asset.asset_group?.tweaked_group_key?.toString('hex') ?? '';
			const unit = asset.asset_genesis.name || asset_id.slice(0, 8);
			map.set(asset_id, {group_key, unit});
		}
		return map;
	}

	/**
	 * Converts a Buffer to hex string
	 */
	private bufferToHex(buf: Buffer): string {
		return Buffer.from(buf).toString('hex');
	}

	/* *******************************************************
		Streaming Backfill
	******************************************************** */

	/** Records a processed hour, seeding first_processed_at on the first call */
	private recordProcessedHour(hour: number): void {
		if (this.backfill_status.first_processed_at == null) this.backfill_status.first_processed_at = hour;
		this.backfill_status.last_processed_at = hour;
	}

	/**
	 * Runs all backfill streams: BTC transactions, asset transfers, asset receives
	 */
	async runStreamingBackfill(): Promise<void> {
		if (this.backfill_status.is_running) {
			this.logger.warn('Bitcoin analytics backfill already running');
			return;
		}

		this.backfill_status = {is_running: true, total_streams: 3, streams_completed: 0, errors: 0};
		this.logger.log('Starting bitcoin analytics backfill');

		try {
			await this.getNodePubkey().catch(() => null);
			if (!this.node_pubkey) {
				this.logger.warn('Lightning node not reachable, skipping bitcoin analytics backfill');
				return;
			}

			const current_hour = DateTime.utc().startOf('hour').toUnixInteger();

			// Stream 1: BTC on-chain transactions
			await this.backfillBtcTransactions(current_hour);
			this.backfill_status.streams_completed++;

			// Streams 2 & 3: Taproot Asset transfers and receives (share asset info map)
			let asset_info_map: AssetInfoMap = new Map();
			try {
				const assets = await this.taprootAssetsService.getListTaprootAssets();
				asset_info_map = this.buildAssetInfoMap(assets.assets ?? []);
			} catch {
				// tapd not configured or unavailable — skip asset streams
			}

			if (asset_info_map.size > 0) {
				await Promise.all([
					this.backfillAssetTransfers(current_hour, asset_info_map),
					this.backfillAssetReceives(current_hour, asset_info_map),
				]);
				this.backfill_status.streams_completed += 2;
			} else {
				this.backfill_status.total_streams -= 2;
			}

			this.logger.log('Bitcoin analytics backfill complete');
		} catch (error) {
			this.logger.error('Bitcoin analytics backfill error', error);
			this.backfill_status.errors++;
		} finally {
			this.backfill_status.is_running = false;
		}
	}

	/* *******************************************************
		Stream 1: BTC On-Chain Transactions
	******************************************************** */

	/**
	 * Backfills BTC on-chain transactions from LND/CLN wallet.
	 * Groups transactions by hour and upserts metrics.
	 * Checkpoint tracks the last processed transaction timestamp.
	 */
	private async backfillBtcTransactions(current_hour: number): Promise<void> {
		const checkpoint_ts = await this.getCheckpoint('transactions');
		const node_pubkey = await this.getNodePubkey();

		let transactions: LightningTransaction[];
		try {
			transactions = await this.lightningService.getTransactions();
		} catch (error) {
			this.logger.warn('Failed to fetch on-chain transactions', error);
			return;
		}

		// Filter to transactions after checkpoint and with valid amount data
		const new_txs = transactions.filter((tx) => tx.time_stamp > checkpoint_ts && tx.amount !== null);
		if (new_txs.length === 0) return;

		// Group by hour
		const buckets: Map<number, LightningTransaction[]> = new Map();
		for (const tx of new_txs) {
			const hour = DateTime.fromSeconds(tx.time_stamp, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			if (hour >= current_hour) continue;

			if (!buckets.has(hour)) buckets.set(hour, []);
			buckets.get(hour)!.push(tx);
		}

		// Flush all complete hours
		for (const [hour, txs] of Array.from(buckets.entries()).sort(([a], [b]) => a - b)) {
			let payments_in_amount = BigInt(0);
			let payments_in_count = 0;
			let payments_out_amount = BigInt(0);
			let payments_out_count = 0;
			let fees_amount = BigInt(0);
			let fees_count = 0;

			for (const tx of txs) {
				const amount = BigInt(tx.amount!);
				if (amount > BigInt(0)) {
					payments_in_amount += amount;
					payments_in_count++;
				} else if (amount < BigInt(0)) {
					payments_out_amount += -amount; // Store as positive
					payments_out_count++;
				}

				const fees = BigInt(tx.total_fees ?? '0');
				if (fees > BigInt(0)) {
					fees_amount += fees;
					fees_count++;
				}
			}

			await this.upsertMetric({
				node_pubkey,
				group_key: '',
				unit: 'sat',
				metric: BitcoinAnalyticsMetric.payments_in,
				hour,
				amount: payments_in_amount,
				count: payments_in_count,
			});
			await this.upsertMetric({
				node_pubkey,
				group_key: '',
				unit: 'sat',
				metric: BitcoinAnalyticsMetric.payments_out,
				hour,
				amount: payments_out_amount,
				count: payments_out_count,
			});
			await this.upsertMetric({
				node_pubkey,
				group_key: '',
				unit: 'sat',
				metric: BitcoinAnalyticsMetric.fees,
				hour,
				amount: fees_amount,
				count: fees_count,
			});

			this.recordProcessedHour(hour);
		}

		// Save checkpoint from flushed records only (not current-hour records)
		if (buckets.size > 0) {
			const flushed = Array.from(buckets.values()).flat();
			const max_ts = Math.max(...flushed.map((tx) => tx.time_stamp));
			await this.saveCheckpoint('transactions', max_ts);
		}
	}

	/* *******************************************************
		Stream 2: Taproot Asset Transfers (Sends)
	******************************************************** */

	/**
	 * Backfills outbound taproot asset transfers from tapd.
	 * Checkpoint tracks the last processed transfer timestamp.
	 */
	private async backfillAssetTransfers(current_hour: number, asset_info_map: AssetInfoMap): Promise<void> {
		let transfers: AssetTransfer[];

		try {
			const transfers_result = await this.taprootAssetsService.getListTransfers();
			transfers = transfers_result.transfers ?? [];
		} catch {
			// tapd not configured or unavailable — skip silently
			return;
		}

		const checkpoint_ts = await this.getCheckpoint('asset_transfers');
		const node_pubkey = await this.getNodePubkey();

		// Filter to transfers after checkpoint
		const new_transfers = transfers.filter((t) => Number(t.transfer_timestamp) > checkpoint_ts);
		if (new_transfers.length === 0) return;

		// Group by hour
		const buckets: Map<number, AssetTransfer[]> = new Map();
		for (const transfer of new_transfers) {
			const ts = Number(transfer.transfer_timestamp);
			const hour = DateTime.fromSeconds(ts, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			if (hour >= current_hour) continue;

			if (!buckets.has(hour)) buckets.set(hour, []);
			buckets.get(hour)!.push(transfer);
		}

		// Flush all complete hours
		for (const [hour, hour_transfers] of Array.from(buckets.entries()).sort(([a], [b]) => a - b)) {
			// Aggregate by group_key for asset amounts
			const asset_out: Map<string, {amount: bigint; count: number; unit: string}> = new Map();
			let fees_amount = BigInt(0);
			let fees_count = 0;

			for (const transfer of hour_transfers) {
				// Track anchor tx chain fees (BTC fees for asset transfers)
				const chain_fees = BigInt(transfer.anchor_tx_chain_fees || '0');
				if (chain_fees > BigInt(0)) {
					fees_amount += chain_fees;
					fees_count++;
				}

				// Track outbound asset amounts (outputs not local to us)
				for (const output of transfer.outputs) {
					if (output.script_key_is_local) continue; // Skip change outputs

					const asset_id = this.bufferToHex(output.asset_id);
					const info = asset_info_map.get(asset_id);
					if (!info) continue;

					const existing = asset_out.get(info.group_key) ?? {amount: BigInt(0), count: 0, unit: info.unit};
					existing.amount += BigInt(output.amount);
					existing.count++;
					asset_out.set(info.group_key, existing);
				}
			}

			// Upsert BTC fees from asset transfers
			await this.upsertMetric({
				node_pubkey,
				group_key: '',
				unit: 'sat',
				metric: BitcoinAnalyticsMetric.fees,
				hour,
				amount: fees_amount,
				count: fees_count,
			});

			// Upsert asset-specific payments_out
			for (const [group_key, {amount, count, unit}] of Array.from(asset_out)) {
				await this.upsertMetric({
					node_pubkey,
					group_key,
					unit,
					metric: BitcoinAnalyticsMetric.payments_out,
					hour,
					amount,
					count,
				});
			}

			this.recordProcessedHour(hour);
		}

		// Save checkpoint from flushed records only (not current-hour records)
		if (buckets.size > 0) {
			const flushed = Array.from(buckets.values()).flat();
			const max_ts = Math.max(...flushed.map((t) => Number(t.transfer_timestamp)));
			await this.saveCheckpoint('asset_transfers', max_ts);
		}
	}

	/* *******************************************************
		Stream 3: Taproot Asset Receives
	******************************************************** */

	/**
	 * Backfills incoming taproot asset receives from tapd.
	 * Only processes completed events (status=4).
	 * Checkpoint tracks the last processed event timestamp.
	 */
	private async backfillAssetReceives(current_hour: number, asset_info_map: AssetInfoMap): Promise<void> {
		let events: AddrEvent[];

		try {
			const receives_result = await this.taprootAssetsService.getAddrReceives(undefined, 4); // completed only
			events = receives_result.events ?? [];
		} catch {
			// tapd not configured or unavailable — skip silently
			return;
		}

		const checkpoint_ts = await this.getCheckpoint('asset_receives');
		const node_pubkey = await this.getNodePubkey();

		// Filter to events after checkpoint
		const new_events = events.filter((e) => Number(e.creation_time_unix_seconds) > checkpoint_ts);
		if (new_events.length === 0) return;

		// Group by hour
		const buckets: Map<number, AddrEvent[]> = new Map();
		for (const event of new_events) {
			const ts = Number(event.creation_time_unix_seconds);
			const hour = DateTime.fromSeconds(ts, {zone: 'UTC'}).startOf('hour').toUnixInteger();
			if (hour >= current_hour) continue;

			if (!buckets.has(hour)) buckets.set(hour, []);
			buckets.get(hour)!.push(event);
		}

		// Flush all complete hours
		for (const [hour, hour_events] of Array.from(buckets.entries()).sort(([a], [b]) => a - b)) {
			// Aggregate by group_key
			const asset_in: Map<string, {amount: bigint; count: number; unit: string}> = new Map();

			for (const event of hour_events) {
				const asset_id = this.bufferToHex(event.addr.asset_id);
				// Use group_key from addr directly (AddrReceives provides it)
				const group_key_from_addr = this.bufferToHex(event.addr.group_key);
				// Fall back to asset info map for unit name
				const info = asset_info_map.get(asset_id);
				const group_key = group_key_from_addr || info?.group_key || '';
				const unit = info?.unit || asset_id.slice(0, 8);

				const existing = asset_in.get(group_key) ?? {amount: BigInt(0), count: 0, unit};
				existing.amount += BigInt(event.addr.amount);
				existing.count++;
				asset_in.set(group_key, existing);
			}

			// Upsert asset-specific payments_in
			for (const [group_key, {amount, count, unit}] of Array.from(asset_in)) {
				await this.upsertMetric({
					node_pubkey,
					group_key,
					unit,
					metric: BitcoinAnalyticsMetric.payments_in,
					hour,
					amount,
					count,
				});
			}

			this.recordProcessedHour(hour);
		}

		// Save checkpoint from flushed records only (not current-hour records)
		if (buckets.size > 0) {
			const flushed = Array.from(buckets.values()).flat();
			const max_ts = Math.max(...flushed.map((e) => Number(e.creation_time_unix_seconds)));
			await this.saveCheckpoint('asset_receives', max_ts);
		}
	}

	/* *******************************************************
		Rescan
	******************************************************** */

	/**
	 * Re-scans recent records to catch late confirmations and status changes.
	 * Resets checkpoints back by RESCAN_SECONDS to re-process recent data.
	 */
	async rescanRecentRecords(): Promise<void> {
		if (this.backfill_status.is_running) {
			this.logger.warn('Bitcoin analytics backfill already running, skipping rescan');
			return;
		}
		this.logger.log('Resetting bitcoin analytics checkpoints for rescan');

		const tx_checkpoint = await this.getCheckpoint('transactions');
		const transfers_checkpoint = await this.getCheckpoint('asset_transfers');
		const receives_checkpoint = await this.getCheckpoint('asset_receives');

		await this.saveCheckpoint('transactions', Math.max(0, tx_checkpoint - RESCAN_SECONDS));
		await this.saveCheckpoint('asset_transfers', Math.max(0, transfers_checkpoint - RESCAN_SECONDS));
		await this.saveCheckpoint('asset_receives', Math.max(0, receives_checkpoint - RESCAN_SECONDS));

		await this.runStreamingBackfill();
	}
}
