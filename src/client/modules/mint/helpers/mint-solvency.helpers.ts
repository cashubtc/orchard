/* Application Dependencies */
import {toSats} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Shared Dependencies */
import {MintReserveSource, MintReserveStatus} from '@shared/generated.types';

/**
 * Sums the selected reserve sources that could be read
 * @param {MintReserves} reserves - Liabilities and reserve sources
 * @param {readonly MintReserveSource[]} selected - Sources the operator counts as reserves
 * @returns {{amount: number | null, partial: boolean}} Sats held, null when no selected source could be read; partial when a selected source failed
 */
export function getSolvencyReserves(
	reserves: MintReserves,
	selected: readonly MintReserveSource[],
): {amount: number | null; partial: boolean} {
	const selected_sources = reserves.sources.filter((source) => selected.includes(source.source));
	const readable_sources = selected_sources.filter((source) => source.status === MintReserveStatus.Available);
	return {
		amount: readable_sources.length > 0 ? readable_sources.reduce((sum, source) => sum + (source.amount ?? 0), 0) : null,
		partial: selected_sources.some((source) => source.status === MintReserveStatus.Unavailable),
	};
}

/**
 * How many times reserves cover liabilities, unrounded so thresholds like 1x stay exact
 * @param {number | null} held_sats - Reserves in sats
 * @param {number} liabilities - Liabilities in the unit's stored base units
 * @param {string} unit - Unit the liabilities are denominated in
 * @returns {number | null} The multiple; null for non-bitcoin units, no liabilities or unknown reserves
 */
export function getSolvencyMultiple(held_sats: number | null, liabilities: number, unit: string): number | null {
	const liabilities_sats = toSats(unit, liabilities);
	if (held_sats === null || !liabilities_sats) return null;
	return held_sats / liabilities_sats;
}

/**
 * How many times the selected reserves cover a unit's liabilities
 * @param {MintReserves} reserves - Liabilities and reserve sources
 * @param {readonly MintReserveSource[]} selected - Sources the operator counts as reserves
 * @param {string} unit - Unit whose liabilities to cover
 * @returns {number | null} The unrounded multiple, or null when it can't be computed
 */
export function getSolvencyRatio(reserves: MintReserves, selected: readonly MintReserveSource[], unit: string): number | null {
	const liability = reserves.liabilities.find((item) => item.unit === unit.toLowerCase());
	if (!liability) return null;
	return getSolvencyMultiple(getSolvencyReserves(reserves, selected).amount, liability.amount, liability.unit);
}

/**
 * Rounds a multiple for display: one decimal under 5x, whole multiples above
 * @param {number} multiple - The unrounded multiple
 * @returns {number} The display value
 */
export function roundSolvencyMultiple(multiple: number): number {
	if (multiple < 5) return Math.round(multiple * 10) / 10;
	return Math.round(multiple);
}
