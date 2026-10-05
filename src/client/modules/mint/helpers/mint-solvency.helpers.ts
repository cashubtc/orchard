/* Application Dependencies */
import {toSats} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
import {CHANNEL_RESERVE_SOURCES, RESERVE_SOURCE_LABELS} from '@client/modules/mint/constants/mint.constants';
/* Shared Dependencies */
import {MintReserveSource} from '@shared/generated.types';

/**
 * How many times reserves cover liabilities, unrounded so thresholds like 1x stay exact
 * @param {number | null} reserves_sats - Reserves in sats
 * @param {number} liabilities - Liabilities in the unit's stored base units
 * @param {string} unit - Unit the liabilities are denominated in
 * @returns {number | null} The multiple; null for non-bitcoin units, no liabilities or unknown reserves
 */
export function getSolvencyMultiple(reserves_sats: number | null, liabilities: number, unit: string): number | null {
	const liabilities_sats = toSats(unit, liabilities);
	if (reserves_sats === null || !liabilities_sats) return null;
	return reserves_sats / liabilities_sats;
}

/**
 * How many times the operator's reserves cover a unit's liabilities
 * @param {MintReserves} reserves - Liabilities, reserve sources and the reserves total
 * @param {string} unit - Unit whose liabilities to cover
 * @returns {number | null} The unrounded multiple, or null when it can't be computed
 */
export function getSolvencyRatio(reserves: MintReserves, unit: string): number | null {
	const liability = reserves.liabilities.find((item) => item.unit === unit.toLowerCase());
	if (!liability) return null;
	return getSolvencyMultiple(reserves.reserves, liability.amount, liability.unit);
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

/**
 * Names the selected reserve sources, for the assets caption
 * @param {readonly MintReserveSource[]} selected - Sources the operator counts as reserves
 * @returns {string} Lightning local capacity for every channel, a source's own name when it stands alone, otherwise a count
 */
export function getReserveSourcesLabel(selected: readonly MintReserveSource[]): string {
	const every_channel =
		selected.length === CHANNEL_RESERVE_SOURCES.length && CHANNEL_RESERVE_SOURCES.every((source) => selected.includes(source));
	if (every_channel) return 'Lightning local capacity';
	if (selected.length === 0) return 'No reserves selected';
	if (selected.length === 1) return RESERVE_SOURCE_LABELS[selected[0]];
	return `${selected.length} reserve sources`;
}
