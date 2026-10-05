/* Native Dependencies */
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Shared Dependencies */
import {MintReserveSource} from '@shared/generated.types';
/* Local Dependencies */
import {getReserveSourcesLabel, getSolvencyMultiple, getSolvencyRatio, roundSolvencyMultiple} from './mint-solvency.helpers';

describe('mint-solvency.helpers', () => {
	describe('getSolvencyMultiple', () => {
		it('divides reserves in sats by liabilities converted to sats', () => {
			expect(getSolvencyMultiple(50000, 12000, 'sat')).toBeCloseTo(4.1667);
			expect(getSolvencyMultiple(50000, 12_000_000, 'msat')).toBeCloseTo(4.1667);
			expect(getSolvencyMultiple(50000, 0.0005, 'btc')).toBe(1);
		});

		it('has no multiple for non-bitcoin units, no liabilities or unknown reserves', () => {
			expect(getSolvencyMultiple(50000, 100, 'usd')).toBeNull();
			expect(getSolvencyMultiple(50000, 0, 'sat')).toBeNull();
			expect(getSolvencyMultiple(null, 100, 'sat')).toBeNull();
		});
	});

	describe('getSolvencyRatio', () => {
		const reserves = (reserves_sats: number | null) =>
			new MintReserves({liabilities: [{unit: 'sat', amount: 12000}], sources: [], reserves: reserves_sats, partial: false});

		it("covers the unit's liabilities with the operator's reserves", () => {
			expect(getSolvencyRatio(reserves(50000), 'SAT')).toBeCloseTo(4.1667);
		});

		it('has no ratio for a unit without liabilities or without readable reserves', () => {
			expect(getSolvencyRatio(reserves(50000), 'msat')).toBeNull();
			expect(getSolvencyRatio(reserves(null), 'sat')).toBeNull();
		});
	});

	describe('roundSolvencyMultiple', () => {
		it('keeps one decimal under 5x and whole multiples above', () => {
			expect(roundSolvencyMultiple(0.96)).toBe(1);
			expect(roundSolvencyMultiple(4.1667)).toBe(4.2);
			expect(roundSolvencyMultiple(6.25)).toBe(6);
		});
	});

	describe('getReserveSourcesLabel', () => {
		it('keeps the long-standing caption for every channel, in any order', () => {
			expect(getReserveSourcesLabel([MintReserveSource.LightningInactive, MintReserveSource.LightningActive])).toBe(
				'Lightning local capacity',
			);
		});

		it('names a lone source, counts several, and says when none are selected', () => {
			expect(getReserveSourcesLabel([MintReserveSource.MintWallet])).toBe('Mint on-chain wallet');
			expect(getReserveSourcesLabel([MintReserveSource.LightningActive, MintReserveSource.MintWallet])).toBe('2 reserve sources');
			expect(getReserveSourcesLabel([])).toBe('No reserves selected');
		});
	});
});
