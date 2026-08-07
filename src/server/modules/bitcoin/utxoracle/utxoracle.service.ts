/* Core Dependencies */
import {Injectable} from '@nestjs/common';
/* Vendor Dependencies */
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, Between} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {BitcoinRpcService} from '@server/modules/bitcoin/rpc/btcrpc.service';
/* Local Dependencies */
import {UTXOracleRunOptions, UTXOracleResult} from './utxoracle.types.js';
import {UTXOracle} from './utxoracle.entity.js';
import {UTXOracleProgressTracker} from './utxoracle.progress.js';

@Injectable()
export class BitcoinUTXOracleService {
	private readonly DEFAULT_RECENT_BLOCKS = 144; // ~1 day of blocks
	private readonly MIN_OUTPUT_BTC = 1e-5; // 0.00001 BTC
	private readonly MAX_OUTPUT_BTC = 1e5; // 100,000 BTC

	constructor(
		private bitcoinRpcService: BitcoinRpcService,
		@InjectRepository(UTXOracle)
		private utxOracleRepository: Repository<UTXOracle>,
	) {}

	public async runOracle(options: UTXOracleRunOptions): Promise<UTXOracleResult> {
		const progress = new UTXOracleProgressTracker(options.progress_callback);
		const date = options.date;
		if (date) return this.runDateMode(options, progress);
		return this.runRecentMode(options, progress);
	}

	/**
	 * Save oracle price to database for a specific date
	 * @param {number} date_timestamp - Unix timestamp in seconds (midnight UTC)
	 * @param {number} price - Central price from oracle
	 * @returns {Promise<OraclePrice>} Saved oracle price record
	 */
	public async saveOraclePrice(date_timestamp: number, price: number): Promise<UTXOracle> {
		const existing = await this.utxOracleRepository.findOne({where: {date: date_timestamp}});
		if (existing) {
			await this.utxOracleRepository.update(existing.id, {price});
			return this.utxOracleRepository.findOne({where: {id: existing.id}});
		} else {
			const utxOracle = this.utxOracleRepository.create({
				date: date_timestamp,
				price,
			});
			return this.utxOracleRepository.save(utxOracle);
		}
	}

	/**
	 * Get most recent oracle price
	 * @returns {Promise<UTXOracle | null>} Oracle price record or null
	 */
	public async getOraclePrice(): Promise<UTXOracle | null> {
		const records = await this.utxOracleRepository.find({
			order: {date: 'DESC'},
			take: 1,
		});
		return records[0] || null;
	}

	/**
	 * Get oracle prices for a date range
	 * @param {number} start_timestamp - Start date Unix timestamp (inclusive)
	 * @param {number} end_timestamp - End date Unix timestamp (inclusive)
	 * @returns {Promise<UTXOracle[]>} Array of oracle price records, sorted by date ascending
	 */
	public async getOraclePriceRange(start_timestamp: number, end_timestamp: number): Promise<UTXOracle[]> {
		return this.utxOracleRepository.find({
			where: {
				date: Between(start_timestamp, end_timestamp),
			},
			order: {
				date: 'ASC',
			},
		});
	}

	private async runRecentMode(options: UTXOracleRunOptions, progress: UTXOracleProgressTracker): Promise<UTXOracleResult> {
		const report_connection = progress.createConnectionTracker();
		report_connection(); // 0% - Start connecting
		report_connection(); // 20% - Validate credentials
		const recent_blocks = options.recent_blocks ?? this.DEFAULT_RECENT_BLOCKS;
		report_connection(); // 40% - Getting block count
		const include_intraday = options.intraday === true;
		const tip = await this.bitcoinRpcService.getBitcoinBlockCount();
		report_connection(); // 60% - Getting consensus tip
		const consensus_tip = tip - 6;
		const start = Math.max(0, consensus_tip - recent_blocks);
		const end = consensus_tip;
		report_connection(); // 80% - Getting block header (if needed)
		report_connection(); // 100% - Connected to node

		const {central_price, rough_price_estimate, deviation_pct, bounds, intraday} = await this.computeWindow(
			start,
			end,
			include_intraday,
			progress,
		);

		const result: UTXOracleResult = {
			central_price,
			rough_price_estimate,
			deviation_pct,
			bounds,
			block_window: {start, end},
			...(include_intraday ? {intraday} : {}),
		};
		return result;
	}

	private async runDateMode(options: UTXOracleRunOptions, progress: UTXOracleProgressTracker): Promise<UTXOracleResult> {
		if (!options.date) throw new Error('Date mode requires options.date in YYYY-MM-DD');
		const report_connection = progress.createConnectionTracker();
		report_connection(); // 0% - Start connecting
		report_connection(); // 20% - Validate credentials
		report_connection(); // 40% - Getting block count
		const tip = await this.bitcoinRpcService.getBitcoinBlockCount();
		const consensus_tip = tip - 6;
		report_connection(); // 60% - Getting consensus tip
		const tip_hash = await this.bitcoinRpcService.getBitcoinBlockHash(consensus_tip);
		report_connection(); // 80% - Getting block header
		await this.bitcoinRpcService.getBitcoinBlockHeader(tip_hash);
		report_connection(); // 100% - Connected
		const include_intraday = options.intraday === true;
		const {start, end} = await this.findBlockWindowForDate(options.date, progress);
		const {central_price, rough_price_estimate, deviation_pct, bounds, intraday} = await this.computeWindow(
			start,
			end,
			include_intraday,
			progress,
		);
		return {
			central_price,
			rough_price_estimate,
			deviation_pct,
			bounds,
			block_window: {start, end},
			...(include_intraday ? {intraday} : {}),
		};
	}

	private async findBlockWindowForDate(timestamp: number, progress: UTXOracleProgressTracker): Promise<{start: number; end: number}> {
		const tip = await this.bitcoinRpcService.getBitcoinBlockCount();
		const consensus_tip = tip - 6;
		const dt = DateTime.fromSeconds(timestamp, {zone: 'utc'});
		const midnight = dt.startOf('day');
		const ts0 = midnight.toSeconds();
		const ts1 = midnight.plus({days: 1}).toSeconds();
		const date_str = dt.toFormat('MMM dd, yyyy');

		const get_time = async (height: number): Promise<number> => {
			const h = await this.bitcoinRpcService.getBitcoinBlockHash(height);
			const header = await this.bitcoinRpcService.getBitcoinBlockHeader(h);
			return header.time as number;
		};
		progress.emit('finding_start', 0, `Finding first block on ${date_str}...`); // 0% - Finding first block
		const lower_bound = async (target_ts: number): Promise<number> => {
			let lo = 0;
			let hi = consensus_tip;
			while (lo < hi) {
				const mid = Math.floor((lo + hi) / 2);
				const t = await get_time(mid);
				if (t < target_ts) lo = mid + 1;
				else hi = mid;
			}
			return lo;
		};
		const start = await lower_bound(ts0);
		progress.emit('finding_start', 100, `Found first block on ${date_str}`); // 100% - Found first block
		progress.emit('finding_end', 0, `Finding last block on ${date_str}...`); // 0% - Finding last block
		const end_plus_one = await lower_bound(ts1);
		const end = Math.max(start, end_plus_one - 1);
		progress.emit('finding_end', 100, `Found last block on ${date_str}`); // 100% - Found last block
		return {start, end};
	}

	private async computeWindow(
		start: number,
		end: number,
		include_intraday: boolean,
		progress: UTXOracleProgressTracker,
	): Promise<{
		central_price: number;
		rough_price_estimate: number;
		deviation_pct: number;
		bounds: {min: number; max: number};
		intraday: Array<{block_height: number; timestamp: number; price: number}>;
	}> {
		progress.emit('loading_transactions', 0, 'Loading transactions from the block window...'); // 0% - Loading transactions
		// Pre-scan window txids to detect same-day inputs
		const window_txids = await this.collectWindowTxids(start, end, progress);
		// 1) Build histogram from v2 block txs with filters
		const histogram = await this.buildHistogram(start, end, window_txids, progress);
		// 2) Smooth/normalize
		this.smoothAndNormalize(histogram);
		progress.emit('loading_transactions', 90, 'Computing rough price estimate...'); // 90% - Computing rough price estimate
		// 3) Slide stencils and compute rough price (neighbor-weighted)
		const rough_price_estimate = this.computeRoughPrice(histogram);
		progress.emit('computing_prices', 0, 'Finding central price'); // 0% - Finding central price
		// 4) Create intraday points and compute central price + deviation
		const {central_price, deviation_pct, bounds, intraday} = await this.computeCentralPrice(
			start,
			end,
			rough_price_estimate,
			window_txids,
			include_intraday,
			progress,
		);
		progress.emit('computing_prices', 100, 'Completed computing window'); // 100% - Completed computing window
		return {central_price, rough_price_estimate, deviation_pct, bounds, intraday};
	}

	private async collectWindowTxids(start: number, end: number, progress: UTXOracleProgressTracker): Promise<Set<string>> {
		const set = new Set<string>();
		const report_progress = progress.createBlockIterator(
			'loading_transactions',
			start,
			end,
			'Pre-scanning transactions in block {height} ({current}/{total})',
			0,
			20, // takes 20% of loading_transactions stage
		);
		for (let height = start; height <= end; height++) {
			const hash = await this.bitcoinRpcService.getBitcoinBlockHash(height);
			const block = await this.bitcoinRpcService.getBitcoinBlock(hash);
			for (const tx of block.tx) set.add(tx.txid);
			report_progress(height);
		}
		return set;
	}

	private output_bins_cache: number[] | null = null;
	private getOutputHistogramBins(): number[] {
		if (this.output_bins_cache) return this.output_bins_cache;
		const bins: number[] = [0.0];
		for (let exponent = -6; exponent < 6; exponent++) {
			for (let b = 0; b < 200; b++) {
				bins.push(10 ** (exponent + b / 200));
			}
		}
		this.output_bins_cache = bins;
		return bins;
	}

	private upperBound(arr: number[], target: number): number {
		let lo = 0,
			hi = arr.length;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (arr[mid] <= target) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	}

	private mapAmountToBin(amount: number): number {
		const bins = this.getOutputHistogramBins();
		let idx = this.upperBound(bins, amount) - 1;
		if (idx < 0) idx = 0;
		if (idx >= bins.length) idx = bins.length - 1;
		return idx;
	}

	private async buildHistogram(
		start: number,
		end: number,
		_window_txids: Set<string>,
		progress: UTXOracleProgressTracker,
	): Promise<Float64Array> {
		const counts = new Float64Array(1 + 200 * 12);
		const min_btc = this.MIN_OUTPUT_BTC;
		const max_btc = this.MAX_OUTPUT_BTC;
		const seen_txids = new Set<string>();
		const report_progress = progress.createBlockIterator(
			'loading_transactions', // Changed from 'computing_prices'
			start,
			end,
			'Analyzing transaction patterns in block {height} ({current}/{total})',
			20, // Start at 20% of loading_transactions stage
			80, // Use remaining 80% of loading_transactions stage
		);

		for (let height = start; height <= end; height++) {
			const hash = await this.bitcoinRpcService.getBitcoinBlockHash(height);
			const block = await this.bitcoinRpcService.getBitcoinBlock(hash);
			for (const tx of block.tx) {
				// coinbase detection
				const is_coinbase = (tx.vin || []).some((v: any) => v.coinbase !== undefined || (!v.txid && v.vout === undefined));
				if (is_coinbase) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				if (tx.vin.length > 5) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				if (tx.vout.length !== 2) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				const has_op_return = tx.vout.some((v) => v.scriptPubKey?.type === 'nulldata');
				if (has_op_return) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				// same-day input exclusion: only consider inputs referencing already-seen txids
				const same_day_input = (tx.vin || []).some((v: any) => v.txid && seen_txids.has(v.txid));
				if (same_day_input) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				// witness length threshold: sum per-input stack and cap at 500 total or item
				let witness_exceeds = false;
				for (const v of tx.vin || []) {
					const w = v.txinwitness || [];
					if (!w || w.length === 0) continue;
					let total = 0;
					for (const item of w) {
						const len = Buffer.from(item, 'hex').length;
						total += len;
						if (len > 500 || total > 500) {
							witness_exceeds = true;
							break;
						}
					}
					if (witness_exceeds) break;
				}
				if (witness_exceeds) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				for (const vout of tx.vout) {
					const value_btc = vout.value;
					if (value_btc <= min_btc || value_btc >= max_btc) continue;
					const bin_index = this.mapAmountToBin(value_btc);
					if (bin_index >= 0 && bin_index < counts.length) counts[bin_index] += 1.0;
				}
				if (tx.txid) seen_txids.add(tx.txid);
			}
			report_progress(height);
		}
		return counts;
	}

	private smoothAndNormalize(counts: Float64Array): void {
		for (let i = 0; i <= 200 && i < counts.length; i++) counts[i] = 0;
		for (let i = 1601; i < counts.length; i++) counts[i] = 0;
		const round_bins = [201, 401, 461, 496, 540, 601, 661, 696, 740, 801, 861, 896, 940, 1001, 1061, 1096, 1140, 1201];
		for (const r of round_bins) {
			if (r - 1 >= 0 && r + 1 < counts.length) counts[r] = 0.5 * (counts[r - 1] + counts[r + 1]);
		}
		let sum = 0;
		for (let i = 201; i <= 1600 && i < counts.length; i++) sum += counts[i];
		if (sum <= 0) return;
		for (let i = 201; i <= 1600 && i < counts.length; i++) {
			counts[i] = counts[i] / sum;
			if (counts[i] > 0.008) counts[i] = 0.008;
		}
	}

	private computeRoughPrice(counts: Float64Array): number {
		const len = 803;
		const mean = 411;
		const std_dev = 201;
		const smooth = new Float64Array(len);
		for (let x = 0; x < len; x++) {
			const exp_part = -((x - mean) ** 2) / (2 * std_dev ** 2);
			smooth[x] = 0.0015 * Math.E ** exp_part + 0.0000005 * x;
		}
		const spike = new Float64Array(len);
		const assign = (i: number, v: number) => {
			if (i >= 0 && i < len) spike[i] = v;
		};
		assign(40, 0.001300198324984352);
		assign(141, 0.001676746949820743);
		assign(201, 0.003468805546942046);
		assign(202, 0.001991977522512513);
		assign(236, 0.001905066647961839);
		assign(261, 0.003341772718156079);
		assign(262, 0.002588902624584287);
		assign(296, 0.002577893841190244);
		assign(297, 0.002733728814200412);
		assign(340, 0.003076117748975647);
		assign(341, 0.005613067550103145);
		assign(342, 0.003088253178535568);
		assign(400, 0.002918457489366139);
		assign(401, 0.006174500465286022);
		assign(402, 0.004417068070043504);
		assign(403, 0.002628663628020371);
		assign(436, 0.002858828161543839);
		assign(461, 0.004097463611984264);
		assign(462, 0.003345917406120509);
		assign(496, 0.002521467726855856);
		assign(497, 0.002784125730361008);
		assign(541, 0.003792850444811335);
		assign(601, 0.003688240815848247);
		assign(602, 0.002392400117402263);
		assign(636, 0.001280993059008106);
		assign(661, 0.001654665137536031);
		assign(662, 0.001395501347054946);
		assign(741, 0.001154279140906312);
		assign(801, 0.000832244504868709);

		const smooth_weight = 0.65;
		const center_p001 = 601;
		const left = center_p001 - Math.floor((len + 1) / 2);
		const right = center_p001 + Math.floor((len + 1) / 2);
		const min_slide = -141;
		const max_slide = 201;
		let best_slide = 0;
		let best_score = -Infinity;
		let total_score = 0;
		for (let slide = min_slide; slide < max_slide; slide++) {
			const shifted = counts.slice(left + slide, right + slide);
			let smooth_score = 0;
			for (let i = 0; i < len && i < shifted.length; i++) smooth_score += shifted[i] * smooth[i];
			let spike_score = 0;
			for (let i = 0; i < len && i < shifted.length; i++) spike_score += shifted[i] * spike[i];
			let score = spike_score;
			if (slide < 150) score += smooth_score * smooth_weight;
			if (score > best_score) {
				best_score = score;
				best_slide = slide;
			}
			total_score += score;
		}
		// Neighbor-weighted refinement like python
		const best_bin = center_p001 + best_slide;
		const best_price = 100 / this.binIndexToAmount(best_bin);
		const neighbor_up = counts.slice(left + best_slide + 1, right + best_slide + 1);
		let neighbor_up_score = 0;
		for (let i = 0; i < len && i < neighbor_up.length; i++) neighbor_up_score += neighbor_up[i] * spike[i];
		const neighbor_down = counts.slice(left + best_slide - 1, right + best_slide - 1);
		let neighbor_down_score = 0;
		for (let i = 0; i < len && i < neighbor_down.length; i++) neighbor_down_score += neighbor_down[i] * spike[i];
		const best_neighbor_dir = neighbor_down_score > neighbor_up_score ? -1 : +1;
		const neighbor_bin = center_p001 + best_slide + best_neighbor_dir;
		const neighbor_price = 100 / this.binIndexToAmount(neighbor_bin);
		const avg_score = total_score / (max_slide - min_slide);
		const a1 = best_score - avg_score;
		const a2 = Math.abs((best_neighbor_dir === -1 ? neighbor_down_score : neighbor_up_score) - avg_score);
		const w1 = a1 / (a1 + a2);
		const w2 = a2 / (a1 + a2);
		const rough = w1 * best_price + w2 * neighbor_price;
		return Math.floor(rough);
	}

	private binIndexToAmount(bin_index: number): number {
		if (bin_index === 0) return 0;
		const bins: number[] = [0.0];
		for (let exponent = -6; exponent < 6; exponent++) {
			for (let b = 0; b < 200; b++) {
				const val = 10 ** (exponent + b / 200);
				bins.push(val);
			}
		}
		if (bin_index < 0) bin_index = 0;
		if (bin_index >= bins.length) bin_index = bins.length - 1;
		return bins[bin_index];
	}

	private async computeCentralPrice(
		start: number,
		end: number,
		rough: number,
		window_txids: Set<string>,
		include_intraday: boolean,
		progress: UTXOracleProgressTracker,
	): Promise<{
		central_price: number;
		deviation_pct: number;
		bounds: {min: number; max: number};
		intraday: Array<{block_height: number; timestamp: number; price: number}>;
	}> {
		const usds = [5, 10, 15, 20, 25, 30, 40, 50, 100, 150, 200, 300, 500, 1000];
		const pct_range_wide = 0.25;
		const pct_micro_remove = 0.0001;
		const micro_list: number[] = [];
		for (let i = 0.00005; i < 0.0001; i += 0.00001) micro_list.push(i);
		for (let i = 0.0001; i < 0.001; i += 0.00001) micro_list.push(i);
		for (let i = 0.001; i < 0.01; i += 0.0001) micro_list.push(i);
		for (let i = 0.01; i < 0.1; i += 0.001) micro_list.push(i);
		for (let i = 0.1; i < 1; i += 0.01) micro_list.push(i);

		const output_prices: number[] = [];
		const prices_blocks: number[] = [];
		const prices_times: number[] = [];
		const seen_txids = new Set<string>();
		const report_progress = progress.createBlockIterator(
			'computing_prices',
			start,
			end,
			'Finding price points in block {height} ({current}/{total})',
			0,
			100,
		);

		for (let height = start; height <= end; height++) {
			const hash = await this.bitcoinRpcService.getBitcoinBlockHash(height);
			const block = await this.bitcoinRpcService.getBitcoinBlock(hash);
			const timestamp = block.time;
			for (const tx of block.tx) {
				const is_coinbase = (tx.vin || []).some((v: any) => v.coinbase !== undefined || (!v.txid && v.vout === undefined));
				if (is_coinbase) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				if (tx.vin.length > 5) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				if (tx.vout.length !== 2) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				const has_op_return = tx.vout.some((v) => v.scriptPubKey?.type === 'nulldata');
				if (has_op_return) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				const same_day_input = (tx.vin || []).some((v: any) => v.txid && seen_txids.has(v.txid));
				if (same_day_input) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				let witness_exceeds = false;
				for (const v of tx.vin || []) {
					const w = v.txinwitness || [];
					if (!w || w.length === 0) continue;
					let total = 0;
					for (const item of w) {
						const len = Buffer.from(item, 'hex').length;
						total += len;
						if (len > 500 || total > 500) {
							witness_exceeds = true;
							break;
						}
					}
					if (witness_exceeds) break;
				}
				if (witness_exceeds) {
					if (tx.txid) seen_txids.add(tx.txid);
					continue;
				}
				for (const vout of tx.vout) {
					const n = vout.value;
					for (const usd of usds) {
						const avbtc = usd / rough;
						const up = avbtc * (1 + pct_range_wide);
						const dn = avbtc * (1 - pct_range_wide);
						if (dn < n && n < up) {
							let append = true;
							for (const r of micro_list) {
								const rm_dn = r * (1 - pct_micro_remove);
								const rm_up = r * (1 + pct_micro_remove);
								if (rm_dn < n && n < rm_up) {
									append = false;
									break;
								}
							}
							if (append) {
								output_prices.push(usd / n);
								if (include_intraday) {
									prices_blocks.push(height);
									prices_times.push(timestamp);
								}
							}
						}
					}
				}
				if (tx.txid) seen_txids.add(tx.txid);
			}
			report_progress(height);
		}

		const pct_range_tight = 0.05;
		const center = rough;
		let up = center * (1 + pct_range_tight);
		let dn = center * (1 - pct_range_tight);
		let [central_price, mad] = this.findCentralOutput(output_prices, dn, up);

		// Match python: no iterative re-centering loop (their loop is effectively a no-op)

		const pct_range_med = 0.1;
		up = central_price * (1 + pct_range_med);
		dn = central_price * (1 - pct_range_med);
		[, mad] = this.findCentralOutput(output_prices, dn, up);
		const price_range = up - dn;
		const dev_pct = price_range ? mad / price_range : 0;

		const intraday: Array<{block_height: number; timestamp: number; price: number}> = include_intraday
			? output_prices.map((price, i) => ({block_height: prices_blocks[i], timestamp: prices_times[i], price}))
			: [];

		return {central_price: Math.floor(central_price), deviation_pct: dev_pct, bounds: {min: dn, max: up}, intraday};
	}

	private findCentralOutput(points: number[], min: number, max: number): [number, number] {
		const filtered = points.filter((p) => p > min && p < max).sort((a, b) => a - b);
		const n = filtered.length;
		if (!n) return [0, 0];
		const prefix: number[] = new Array(n);
		let total = 0;
		for (let i = 0; i < n; i++) {
			total += filtered[i];
			prefix[i] = total;
		}
		const left_counts = Array.from({length: n}, (_, i) => i);
		const right_counts = Array.from({length: n}, (_, i) => n - i - 1);
		const left_sums = [0, ...prefix.slice(0, -1)];
		const right_sums = prefix.map((x) => total - x);
		let best_index = 0;
		let best_dist = Infinity;
		for (let i = 0; i < n; i++) {
			const dist = filtered[i] * left_counts[i] - left_sums[i] + (right_sums[i] - filtered[i] * right_counts[i]);
			if (dist < best_dist) {
				best_dist = dist;
				best_index = i;
			}
		}
		const best_output = filtered[best_index];
		const deviations = filtered.map((x) => Math.abs(x - best_output)).sort((a, b) => a - b);
		const m = deviations.length;
		const mad = m % 2 === 0 ? (deviations[m / 2 - 1] + deviations[m / 2]) / 2 : deviations[Math.floor(m / 2)];
		return [best_output, mad];
	}
}
