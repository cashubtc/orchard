/** Most coins a coin stack holds */
const COIN_STACK_MAX = 18;

/**
 * How many coins a value gets beside its counterpart: the larger side a full stack, the smaller its share of it, rounded down
 * @param {number} value - The value this stack shows
 * @param {number} counterpart - The value it is weighed against
 * @returns {number} The coin count, 1 to the stack's max
 */
export function getCoinStackSize(value: number, counterpart: number): number {
	if (!value) return 1;
	if (value >= counterpart) return COIN_STACK_MAX;
	return Math.max(1, Math.floor((value / counterpart) * COIN_STACK_MAX));
}

/**
 * Arranges coins as a pyramid, top row first: 1-3 coins in one column, 4-9 in two tiers, 10-18 in three
 * @param {number} count - The coin count
 * @returns {number[][]} Each row's column heights
 */
export function buildCoinStackRows(count: number): number[][] {
	const tier_groups = count <= 3 ? [1] : count <= 9 ? [2, 1] : [3, 2, 1];
	let remaining = count;
	return tier_groups
		.map((num_groups) => {
			const tier_coins = Math.min(num_groups * 3, remaining);
			remaining -= tier_coins;
			const base = Math.floor(tier_coins / num_groups);
			const extra = tier_coins % num_groups;
			const groups: number[] = [];
			for (let i = 0; i < num_groups; i++) {
				const coins = base + (i >= num_groups - extra ? 1 : 0);
				if (coins > 0) groups.push(coins);
			}
			return groups;
		})
		.filter((groups) => groups.length > 0)
		.reverse();
}

/**
 * Numbers each coin in the order it lands: bottom row first, then layer by layer, left to right within a layer
 * @param {number[][]} rows - Each row's column heights, top row first
 * @returns {number[][][]} Each coin's landing order, laid out like the rows: top row first, each column's top coin first
 */
export function orderCoinStackDrops(rows: number[][]): number[][][] {
	const drops = rows.map((groups) => groups.map((height) => new Array<number>(height).fill(0)));
	let order = 0;
	for (let row = drops.length - 1; row >= 0; row--) {
		const tallest = Math.max(...drops[row].map((column) => column.length));
		for (let layer = 0; layer < tallest; layer++) {
			for (const column of drops[row]) {
				if (layer < column.length) column[column.length - 1 - layer] = order++;
			}
		}
	}
	return drops;
}
