/* Native Dependencies */
import {UnitMeta} from '@client/modules/local/types/unit.types';

const KNOWN_UNITS: Record<string, UnitMeta> = {
	sat: {code: 'sat', decimals: 0, divisor: 1, family: 'btc', asset: 'btc', icon: 'currency_bitcoin', glyph: '₿'},
	msat: {code: 'sat', decimals: 0, divisor: 1000, family: 'btc', asset: 'btc', icon: 'currency_bitcoin', glyph: '₿'},
	btc: {code: 'BTC', decimals: 8, divisor: 1, family: 'btc', asset: 'btc', icon: 'currency_bitcoin', glyph: '₿'},
	usd: {code: 'USD', decimals: 2, divisor: 100, family: 'fiat', asset: 'usd', icon: 'attach_money', glyph: '$'},
	eur: {code: 'EUR', decimals: 2, divisor: 100, family: 'fiat', asset: 'eur', icon: 'euro', glyph: '€'},
};

/**
 * Looks up display metadata for a Cashu unit.
 * Units are free-form strings, so anything Orchard has no entry for is treated as a whole-number custom unit.
 * Hoist this out of loops rather than calling it per item.
 * @param {string} unit - The unit as advertised by the mint
 * @returns {UnitMeta} Display metadata for the unit
 */
export function getUnitMeta(unit: string): UnitMeta {
	const unit_lower = unit?.toLowerCase() ?? '';
	return (
		KNOWN_UNITS[unit_lower] ?? {
			code: unit_lower,
			decimals: 0,
			divisor: 1,
			family: 'custom',
			asset: 'custom',
			icon: 'money_bag',
		}
	);
}

/**
 * Symbol to render alongside an amount, falling back to the unit code.
 * @param {UnitMeta} meta - Metadata for the unit
 * @returns {string} The glyph, or the unit code when it has none
 */
export function getUnitSymbol(meta: UnitMeta): string {
	return meta.glyph ?? meta.code;
}

/**
 * Converts an amount from a unit's stored base units to its display units.
 * @param {UnitMeta} meta - Metadata for the unit
 * @param {number} amount - The amount in base units
 * @returns {number} The amount in display units
 */
export function toDisplayAmountFor(meta: UnitMeta, amount: number): number {
	if (meta.divisor === 1) return amount;
	/* Whole-number units round up to the next display unit; fractional units keep their remainder */
	return meta.decimals === 0 ? Math.ceil(amount / meta.divisor) : amount / meta.divisor;
}

/**
 * Converts an amount from the unit's stored base units to its display units.
 * @param {string} unit - The unit the amount is denominated in
 * @param {number} amount - The amount in base units
 * @returns {number} The amount in display units
 */
export function toDisplayAmount(unit: string, amount: number): number {
	return toDisplayAmountFor(getUnitMeta(unit), amount);
}
