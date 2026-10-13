/* Local Dependencies */
import {buildCoinStackRows, getCoinStackSize} from './graphic-coin-stack.helpers';

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
});
