/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Vendor Dependencies */
import {EventEmitter} from 'events';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {BitcoinUTXOracleService} from '#server/modules/bitcoin/utxoracle/utxoracle.service';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {UTXOracleProgress} from '#server/modules/bitcoin/utxoracle/utxoracle.types';
import {UTXOracleProgressStatus} from '#server/modules/bitcoin/utxoracle/utxoracle.enums';
/* Local Dependencies */
import {OrchardBitcoinOracleBackfillStream, OrchardBitcoinOracleBackfillProgress, OrchardBitcoinOraclePrice} from './btcoracle.model.js';

@Injectable()
export class BitcoinOracleService {
	private readonly logger = new Logger(BitcoinOracleService.name);
	private event_emitter = new EventEmitter();
	private active_streams: Map<string, AbortController> = new Map();

	constructor(
		private errorService: ErrorService,
		private bitcoinUTXOracleService: BitcoinUTXOracleService,
		private bitcoinRpcService: BitcoinRpcService,
	) {}

	public async getOracle(tag: string, start_timestamp?: number, end_timestamp?: number): Promise<OrchardBitcoinOraclePrice[]> {
		try {
			if (start_timestamp && end_timestamp) {
				const prices = await this.bitcoinUTXOracleService.getOraclePriceRange(start_timestamp, end_timestamp);
				return prices.map((price) => new OrchardBitcoinOraclePrice(price));
			} else {
				const price = await this.bitcoinUTXOracleService.getOraclePrice();
				return price ? [new OrchardBitcoinOraclePrice(price)] : [];
			}
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.BitcoinRPCError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Stream backfill oracle prices for a date range and save to database
	 */
	public async streamBackfillOracle(tag: string, id: string, start_date: number, end_date?: number | null): Promise<void> {
		try {
			const controller = new AbortController();
			this.active_streams.set(id, controller);
			const signal = controller.signal;
			const effective_end_date = end_date ?? start_date;

			const validation_error = await this.validateBackfillRequest(start_date, effective_end_date);
			if (validation_error) {
				this.emitUpdate(id, {status: UTXOracleProgressStatus.ERROR, error: validation_error});
				this.active_streams.delete(id);
				return;
			}

			const start = DateTime.fromSeconds(start_date, {zone: 'utc'}).startOf('day');
			const end = DateTime.fromSeconds(effective_end_date, {zone: 'utc'}).startOf('day');
			const total_days = Math.floor(end.diff(start, 'days').days) + 1;

			this.emitUpdate(id, {
				status: UTXOracleProgressStatus.STARTED,
				start_date,
				end_date: effective_end_date,
				total_days,
				processed: 0,
				successful: 0,
				failed: 0,
			});

			const stats = {processed: 0, successful: 0, failed: 0};
			let current = start;

			while (current <= end) {
				if (signal.aborted) {
					this.logger.log(`Backfill aborted for stream ${id}`);
					this.emitUpdate(id, {
						status: UTXOracleProgressStatus.ABORTED,
						start_date,
						end_date: effective_end_date,
						total_days,
						...stats,
					});
					this.active_streams.delete(id);
					return;
				}

				await this.processBackfillDay(id, current, total_days, stats);
				current = current.plus({days: 1});
			}

			this.emitUpdate(id, {
				status: UTXOracleProgressStatus.COMPLETED,
				start_date,
				end_date: effective_end_date,
				total_days,
				...stats,
			});
			this.active_streams.delete(id);
		} catch (error) {
			this.active_streams.delete(id);
			this.logger.error(`Backfill stream error: ${error.message}`, error.stack);
			this.emitUpdate(id, {status: UTXOracleProgressStatus.ERROR, error: error.message});
		}
	}

	/**
	 * Abort a running backfill stream
	 */
	public abortBackfillStream(id: string): OrchardBitcoinOracleBackfillStream {
		const controller = this.active_streams.get(id);
		if (!controller) throw new OrchardApiError(OrchardErrorCode.BitcoinRPCError);
		controller.abort();
		this.active_streams.delete(id);
		return {id};
	}

	/**
	 * Register callback for backfill updates
	 */
	public onBackfillUpdate(callback: (update: OrchardBitcoinOracleBackfillProgress) => void): void {
		this.event_emitter.on('oracle.backfill.update', callback);
	}

	/**
	 * Validate backfill request and return error message if invalid
	 */
	private async validateBackfillRequest(start_timestamp: number, end_timestamp: number): Promise<string | null> {
		const blockchain_info = await this.bitcoinRpcService.getBitcoinBlockchainInfo();
		if (blockchain_info.chain !== 'main') return `Oracle only runs on mainnet. Current chain: ${blockchain_info.chain}`;
		const start = DateTime.fromSeconds(start_timestamp, {zone: 'utc'});
		if (!start.isValid) return `Invalid start_timestamp: ${start_timestamp}`;
		const end = DateTime.fromSeconds(end_timestamp, {zone: 'utc'});
		if (!end.isValid) return `Invalid end_timestamp: ${end_timestamp}`;
		if (start > end) return 'start_timestamp must be before or equal to end_timestamp';
		const today = DateTime.utc().startOf('day');
		if (end >= today) return 'end_timestamp must be before today (can only backfill historical data)';
		return null;
	}

	/**
	 * Process a single day in the backfill operation
	 */
	private async processBackfillDay(
		stream_id: string,
		date: DateTime,
		total_days: number,
		stats: {processed: number; successful: number; failed: number},
	): Promise<void> {
		const date_str = date.toFormat('yyyy-MM-dd');
		const date_timestamp = Math.floor(date.toSeconds());

		try {
			this.logger.log(`Backfilling oracle for ${date_str} (timestamp: ${date_timestamp})...`);
			const progress_callback = (oracle_progress: UTXOracleProgress) => {
				const overall_progress = ((stats.processed + oracle_progress.date_progress / 100) / total_days) * 100;
				this.emitUpdate(stream_id, {
					status: UTXOracleProgressStatus.PROCESSING,
					date: date_timestamp,
					total_days,
					...stats,
					date_progress: oracle_progress.date_progress,
					overall_progress: Math.min(100, Math.max(0, overall_progress)),
					message: oracle_progress.message,
				});
			};
			const result = await this.bitcoinUTXOracleService.runOracle({
				date: date_timestamp,
				intraday: false,
				progress_callback,
			});
			await this.bitcoinUTXOracleService.saveOraclePrice(date_timestamp, result.central_price);
			stats.successful++;
			stats.processed++;
			this.emitUpdate(stream_id, {
				status: UTXOracleProgressStatus.PROCESSING,
				date: date_timestamp,
				price: result.central_price,
				success: true,
				total_days,
				...stats,
			});
			this.logger.log(`Successfully backfilled ${date_str}: price=${result.central_price}`);
		} catch (error) {
			stats.failed++;
			stats.processed++;
			this.logger.error(`Failed to backfill ${date_str}: ${error.message}`);
			this.emitUpdate(stream_id, {
				status: UTXOracleProgressStatus.PROCESSING,
				date: date_timestamp,
				success: false,
				error: error.message,
				total_days,
				...stats,
			});
		}
	}

	/**
	 * Emit a backfill update event
	 */
	private emitUpdate(id: string, data: Partial<OrchardBitcoinOracleBackfillProgress>): void {
		this.event_emitter.emit('oracle.backfill.update', new OrchardBitcoinOracleBackfillProgress({id, ...data}));
	}
}
