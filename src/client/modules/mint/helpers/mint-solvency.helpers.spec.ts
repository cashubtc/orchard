/* Native Dependencies */
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Shared Dependencies */
import {MintReserveSource, MintReserveStatus} from '@shared/generated.types';
/* Local Dependencies */
import {getSolvencyMultiple, getSolvencyRatio, getSolvencyReserves, roundSolvencyMultiple} from './mint-solvency.helpers';

const source = (name: MintReserveSource, amount: number | null, status = MintReserveStatus.Available) => ({source: name, status, amount});
const channels = [MintReserveSource.LightningActive, MintReserveSource.LightningInactive];

describe('mint-solvency.helpers', () => {
	describe('getSolvencyReserves', () => {
		it('sums the selected sources that could be read', () => {
			const reserves = new MintReserves({
				liabilities: [],
				sources: [
					source(MintReserveSource.LightningActive, 600),
					source(MintReserveSource.LightningInactive, 400),
					source(MintReserveSource.MintWallet, 21000),
				],
			});
			expect(getSolvencyReserves(reserves, channels)).toEqual({amount: 1000, partial: false});
		});

		it('flags a selected source that failed, and has no amount when none could be read', () => {
			const reserves = new MintReserves({
				liabilities: [],
				sources: [
					source(MintReserveSource.LightningActive, null, MintReserveStatus.Unavailable),
					source(MintReserveSource.MintWallet, null, MintReserveStatus.Unconfigured),
				],
			});
			expect(getSolvencyReserves(reserves, [MintReserveSource.LightningActive])).toEqual({amount: null, partial: true});
			expect(getSolvencyReserves(reserves, [MintReserveSource.MintWallet])).toEqual({amount: null, partial: false});
		});
	});

	describe('getSolvencyMultiple', () => {
		it('divides sats held by liabilities converted to sats', () => {
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
		const reserves = new MintReserves({
			liabilities: [{unit: 'sat', amount: 12000}],
			sources: [source(MintReserveSource.LightningActive, 50000), source(MintReserveSource.LightningInactive, 0)],
		});

		it("covers the unit's liabilities with the selected reserves", () => {
			expect(getSolvencyRatio(reserves, channels, 'SAT')).toBeCloseTo(4.1667);
		});

		it('has no ratio for a unit without liabilities or without readable reserves', () => {
			expect(getSolvencyRatio(reserves, channels, 'msat')).toBeNull();
			expect(getSolvencyRatio(reserves, [MintReserveSource.MintWallet], 'sat')).toBeNull();
		});
	});

	describe('roundSolvencyMultiple', () => {
		it('keeps one decimal under 5x and whole multiples above', () => {
			expect(roundSolvencyMultiple(0.96)).toBe(1);
			expect(roundSolvencyMultiple(4.1667)).toBe(4.2);
			expect(roundSolvencyMultiple(6.25)).toBe(6);
		});
	});
});
