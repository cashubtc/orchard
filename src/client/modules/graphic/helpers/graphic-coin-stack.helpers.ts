/* Native Dependencies */
import {COIN_STACK_MAX} from '@client/modules/graphic/constants/graphic.constants';

/**
 * How many coins a value gets beside its counterpart, 1 to the stack's max
 * @param {number} value - The value this stack shows
 * @param {number} counterpart - The value it is weighed against
 * @returns {number} The coin count
 */
export function getCoinStackSize(value: number, counterpart: number): number {
	if (!value) return 1;
	if (value > counterpart) return COIN_STACK_MAX;
	const stack = (value / (value + counterpart)) * COIN_STACK_MAX;
	return Math.max(1, Math.min(COIN_STACK_MAX, Math.ceil(stack)));
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
