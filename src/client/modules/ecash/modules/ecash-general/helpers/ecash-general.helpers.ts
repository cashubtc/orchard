/* Application Dependencies */
import {compareUnits} from '@client/modules/local/helpers/unit.helpers';
import {getNumberSeparator} from '@client/modules/local/helpers/local.helpers';
/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMintStatus} from '@client/modules/ecash/classes/ecash-mint-status.class';
import {EcashAmountChar, EcashMintStatusPill, EcashUnitChip} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

/**
 * A mint's status pill: checking until statuses load, then online with latency or unreachable with the reason
 * @param {EcashMintStatus[]} statuses - Every wallet mint's last probe
 * @param {string} mint_id - The mint to describe
 * @param {boolean} loading - Whether statuses are still loading
 * @returns {EcashMintStatusPill} The pill's state, text and error
 */
export function getMintStatusPill(statuses: EcashMintStatus[], mint_id: string, loading: boolean): EcashMintStatusPill {
	if (loading) return {state: 'loading', text: 'Checking', error: null};
	const status = statuses.find((item) => item.mint_id === mint_id);
	if (!status) return {state: 'disabled', text: 'Unknown', error: null};
	if (status.online) {
		const latency = status.latency_ms === null ? '' : ` · ${status.latency_ms} ms`;
		return {state: 'active', text: `Online${latency}`, error: null};
	}
	return {state: 'inactive', text: 'Unreachable', error: status.error};
}

/**
 * One chip per unit offered or held, with the balances summed, bitcoin first
 * @param {string[]} units - Units the mints offer
 * @param {EcashBalance[]} balances - Wallet balances per mint and unit
 * @returns {Required<EcashUnitChip>[]} The chips; 0 for units with no balance
 */
export function buildUnitChips(units: string[], balances: EcashBalance[]): Required<EcashUnitChip>[] {
	const totals = new Map<string, number>(units.map((unit) => [unit.toLowerCase(), 0]));
	for (const {unit, balance} of balances) {
		const key = unit.toLowerCase();
		totals.set(key, (totals.get(key) ?? 0) + balance);
	}
	return [...totals].map(([unit, amount]) => ({unit, amount})).sort((a, b) => compareUnits(a.unit, b.unit));
}

/**
 * Lays a typed amount out character by character in the locale's format
 * @param {string} text - The amount typed so far, with '.' as its decimal point
 * @param {number} decimals - Fraction digits the unit allows
 * @param {string} locale - Locale for digit grouping and the decimal separator
 * @returns {EcashAmountChar[]} The characters, with ghost zeros for an empty amount and untyped fraction digits
 */
export function buildAmountChars(text: string, decimals: number, locale: string): EcashAmountChar[] {
	const [integer, fraction] = text.split('.');
	const typed = (value: string): EcashAmountChar[] => [...value].map((char) => ({char, ghost: false}));
	const ghosts = (count: number): EcashAmountChar[] => Array.from({length: count}, () => ({char: '0', ghost: true}));
	const chars = integer ? typed(Number(integer).toLocaleString(locale)) : ghosts(1);
	if (fraction === undefined || decimals === 0) return chars;
	return [...chars, ...typed(getNumberSeparator(locale, 'decimal')), ...typed(fraction), ...ghosts(decimals - fraction.length)];
}
