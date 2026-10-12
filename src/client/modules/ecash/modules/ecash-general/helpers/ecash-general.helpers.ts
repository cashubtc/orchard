/* Application Dependencies */
import {compareUnits} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashUnitChip} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

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
