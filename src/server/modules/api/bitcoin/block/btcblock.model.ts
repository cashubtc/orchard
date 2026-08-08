/* Core Dependencies */
import {Field, Int, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import type {BitcoinBlock, BitcoinBlockTemplate} from '#server/modules/bitcoin/rpc/btcrpc.types';

@ObjectType({description: 'Bitcoin block data'})
export class OrchardBitcoinBlock {
	@Field(() => String, {description: 'Block hash'})
	hash: string;

	@Field(() => Int, {description: 'Block height in the chain'})
	height: number;

	@Field(() => UnixTimestamp, {description: 'Block timestamp'})
	time: number;

	@Field(() => String, {description: 'Cumulative chainwork in hex'})
	chainwork: string;

	@Field(() => Int, {description: 'Number of transactions in the block'})
	nTx: number;

	@Field(() => Int, {description: 'Block size in bytes'})
	size: number;

	@Field(() => Float, {description: 'Block weight in weight units'})
	weight: number;

	@Field(() => Float, {description: 'Lowest fee rate in the block in sat/vB'})
	feerate_low: number;

	@Field(() => Float, {description: 'Highest fee rate in the block in sat/vB'})
	feerate_high: number;

	constructor(obb: BitcoinBlock) {
		this.hash = obb.hash;
		this.height = obb.height;
		this.time = obb.time;
		this.chainwork = obb.chainwork;
		this.nTx = obb.nTx;
		this.size = obb.size;
		this.weight = obb.weight;
		const {fee_lowest, fee_highest} = this.calculateFeeRange(obb.tx);
		this.feerate_low = fee_lowest;
		this.feerate_high = fee_highest;
	}

	private calculateFeeRange(txs: BitcoinBlock['tx']): {fee_lowest: number; fee_highest: number} {
		let fee_lowest = Infinity;
		let fee_highest = -Infinity;
		// Build lookup maps once for the entire block
		const tx_by_txid = new Map<string, BitcoinBlock['tx'][number]>();
		const children_by_parent = new Map<string, BitcoinBlock['tx'][number][]>();
		const all_txids = new Set<string>();
		// O(n) preprocessing
		txs.forEach((tx) => {
			tx_by_txid.set(tx.txid, tx);
			children_by_parent.set(tx.txid, []);
			all_txids.add(tx.txid);
		});
		// Build parent-child relationships
		txs.forEach((tx) => {
			tx.vin.forEach((input) => {
				if (!children_by_parent.has(input.txid)) return;
				children_by_parent.get(input.txid).push(tx);
			});
		});
		// Find root transactions
		const root_txs = this.findRootTransactionsOptimized(txs, all_txids);
		// Calculate effective feerates using pre-built maps
		root_txs.forEach((tx) => {
			const effective_feerate = this.calculateEffectiveFeerateOptimized(tx, children_by_parent);
			if (effective_feerate === null) return;
			if (effective_feerate < fee_lowest) fee_lowest = effective_feerate;
			if (effective_feerate > fee_highest) fee_highest = effective_feerate;
		});
		return {
			fee_lowest: isFinite(fee_lowest) ? fee_lowest : 0,
			fee_highest: isFinite(fee_highest) ? fee_highest : 0,
		};
	}

	private findRootTransactionsOptimized(all_txs: BitcoinBlock['tx'], all_txids: Set<string>): BitcoinBlock['tx'] {
		const root_txs: BitcoinBlock['tx'] = [];
		all_txs.forEach((tx) => {
			let is_root = true;
			for (const input of tx.vin) {
				if (!all_txids.has(input.txid)) continue;
				is_root = false;
				break;
			}
			if (is_root) root_txs.push(tx);
		});
		return root_txs;
	}

	private calculateEffectiveFeerateOptimized(
		tx: BitcoinBlock['tx'][number],
		children_by_parent: Map<string, BitcoinBlock['tx'][number][]>,
	): number | null {
		if (!tx.fee || !tx.vsize) return null;
		const descendant_txs = this.findAllDescendantsOptimized(tx.txid, children_by_parent);
		if (descendant_txs.length === 0) return (tx.fee * 1000) / tx.vsize;
		const total_effective_fee = tx.fee + descendant_txs.reduce((sum, descendant) => sum + descendant.fee, 0);
		const total_effective_vsize = tx.vsize + descendant_txs.reduce((sum, descendant) => sum + descendant.vsize, 0);
		return (total_effective_fee * 1000) / total_effective_vsize;
	}

	private findAllDescendantsOptimized(
		parent_txid: string,
		children_by_parent: Map<string, BitcoinBlock['tx'][number][]>,
	): BitcoinBlock['tx'][number][] {
		const descendants: BitcoinBlock['tx'][number][] = [];
		const visited = new Set<string>();
		const to_process = [parent_txid];
		while (to_process.length > 0) {
			const current_txid = to_process.shift();
			if (visited.has(current_txid)) continue;
			visited.add(current_txid);
			const children = children_by_parent.get(current_txid) || [];
			children.forEach((child) => {
				if (visited.has(child.txid)) return;
				descendants.push(child);
				to_process.push(child.txid);
			});
		}
		return descendants;
	}
}

@ObjectType({description: 'Bitcoin block template for mining'})
export class OrchardBitcoinBlockTemplate {
	@Field(() => Int, {description: 'Height of the next block to be mined'})
	height: number;

	@Field(() => Int, {description: 'Number of transactions in the template'})
	nTx: number;

	@Field(() => Int, {description: 'Template size in bytes'})
	size: number;

	@Field(() => Int, {description: 'Template weight in weight units'})
	weight: number;

	@Field(() => Float, {description: 'Lowest fee rate in the template in sat/vB'})
	feerate_low: number;

	@Field(() => Float, {description: 'Highest fee rate in the template in sat/vB'})
	feerate_high: number;

	constructor(obbt: BitcoinBlockTemplate) {
		this.height = obbt.height;
		this.nTx = obbt.transactions.length;
		this.size = obbt.transactions.reduce((sum, tx) => sum + tx.data.length / 2, 0);
		this.weight = this.calculateWeight(obbt.transactions);
		const {feerate_low, feerate_high} = this.calculateFeerateRange(obbt.transactions);
		this.feerate_low = feerate_low;
		this.feerate_high = feerate_high;
	}

	private calculateWeight(txs: BitcoinBlockTemplate['transactions']): number {
		return txs.reduce((sum, tx) => sum + tx.weight, 0);
	}

	private calculateFeerateRange(txs: BitcoinBlockTemplate['transactions']): {feerate_low: number; feerate_high: number} {
		let feerate_low = Infinity;
		let feerate_high = -Infinity;
		// Build lookup maps once for the entire block
		const tx_by_txid = new Map<string, (typeof txs)[number]>();
		const children_by_parent = new Map<string, (typeof txs)[number][]>();
		const all_txids = new Set<string>();
		// O(n) preprocessing
		txs.forEach((tx) => {
			tx_by_txid.set(tx.txid, tx);
			children_by_parent.set(tx.txid, []);
			all_txids.add(tx.txid);
		});
		// Build parent-child relationships
		txs.forEach((tx) => {
			tx.depends.forEach((dep_idx: number) => {
				if (dep_idx === 0) return;
				const parent_tx = txs[dep_idx - 1];
				if (!parent_tx) return;
				children_by_parent.get(parent_tx.txid).push(tx);
			});
		});
		// Find root transactions (those with no depends or only 0)
		const root_txs = txs.filter((tx) => !tx.depends || tx.depends.length === 0 || tx.depends.every((d) => d === 0));
		// Calculate effective feerates
		root_txs.forEach((tx) => {
			const effective_feerate = this.calculateEffectiveFeerateOptimized(tx, children_by_parent);
			if (effective_feerate === null) return;
			if (effective_feerate < feerate_low) feerate_low = effective_feerate;
			if (effective_feerate > feerate_high) feerate_high = effective_feerate;
		});
		return {
			feerate_low: isFinite(feerate_low) ? feerate_low : 0,
			feerate_high: isFinite(feerate_high) ? feerate_high : 0,
		};
	}

	private calculateEffectiveFeerateOptimized(
		tx: BitcoinBlockTemplate['transactions'][number],
		children_by_parent: Map<string, BitcoinBlockTemplate['transactions'][number][]>,
	): number | null {
		if (!tx.fee || !tx.weight) return null;
		const descendant_txs = this.findAllDescendantsOptimized(tx.txid, children_by_parent);
		if (descendant_txs.length === 0) return tx.fee / 100000 / (tx.weight / 4);
		const total_effective_fee = tx.fee + descendant_txs.reduce((sum, descendant) => sum + descendant.fee, 0);
		const total_effective_weight = tx.weight + descendant_txs.reduce((sum, descendant) => sum + descendant.weight, 0);
		return total_effective_fee / 100000 / (total_effective_weight / 4);
	}

	private findAllDescendantsOptimized(
		parent_txid: string,
		children_by_parent: Map<string, BitcoinBlockTemplate['transactions'][number][]>,
	): BitcoinBlockTemplate['transactions'][number][] {
		const descendants: BitcoinBlockTemplate['transactions'][number][] = [];
		const visited = new Set<string>();
		const to_process = [parent_txid];
		while (to_process.length > 0) {
			const current_txid = to_process.shift();
			if (visited.has(current_txid)) continue;
			visited.add(current_txid);
			const children = children_by_parent.get(current_txid) || [];
			children.forEach((child) => {
				if (visited.has(child.txid)) return;
				descendants.push(child);
				to_process.push(child.txid);
			});
		}
		return descendants;
	}
}
