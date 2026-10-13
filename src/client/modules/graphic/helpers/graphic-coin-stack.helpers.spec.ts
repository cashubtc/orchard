/* Local Dependencies */
import {buildCoinStackRows, getCoinStackSize, orderCoinStackDrops} from './graphic-coin-stack.helpers';

describe('graphic-coin-stack.helpers', () => {
	describe('getCoinStackSize', () => {
		it('gives the larger side a full stack and the smaller its share of it, at least one coin', () => {
			expect(getCoinStackSize(10_005_068, 3606)).toBe(18);
			expect(getCoinStackSize(3606, 10_005_068)).toBe(1);
			expect(getCoinStackSize(50, 100)).toBe(9);
			expect(getCoinStackSize(0, 100)).toBe(1);
		});

		it('fills both stacks when the sides are equal, and shows any shortfall as fewer coins', () => {
			expect(getCoinStackSize(50, 50)).toBe(18);
			expect(getCoinStackSize(10_005_068, 10_033_616)).toBe(17);
			expect(getCoinStackSize(10_033_616, 10_005_068)).toBe(18);
		});
	});

	describe('buildCoinStackRows', () => {
		it('stacks coins into a pyramid, top row first, leaving out empty tiers', () => {
			expect(buildCoinStackRows(2)).toEqual([[2]]);
			expect(buildCoinStackRows(6)).toEqual([[3, 3]]);
			expect(buildCoinStackRows(10)).toEqual([[1], [3, 3, 3]]);
			expect(buildCoinStackRows(18)).toEqual([[3], [3, 3], [3, 3, 3]]);
		});
	});

	describe('orderCoinStackDrops', () => {
		it('lands the bottom row first, layer by layer from the left, laid out top coin first', () => {
			expect(orderCoinStackDrops([[2, 3]])).toEqual([
				[
					[2, 0],
					[4, 3, 1],
				],
			]);
			expect(orderCoinStackDrops([[1], [3, 3, 3]])).toEqual([
				[[9]],
				[
					[6, 3, 0],
					[7, 4, 1],
					[8, 5, 2],
				],
			]);
		});

		it('numbers every coin once, so the last to land is the top of the stack', () => {
			const drops = orderCoinStackDrops(buildCoinStackRows(18));
			const orders = drops.flat(2).sort((a, b) => a - b);
			expect(orders).toEqual(Array.from({length: 18}, (_, i) => i));
			expect(drops[0][0][0]).toBe(17);
		});
	});
});
