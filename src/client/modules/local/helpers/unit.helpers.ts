export type UnitFamily = 'btc' | 'fiat' | 'custom';

export interface UnitMeta {
	/** Label to render alongside an amount */
	code: string;
	/** Fraction digits to display */
	decimals: number;
	/** Base units stored per display unit */
	divisor: number;
	family: UnitFamily;
	/** Currency symbol, where the unit has one */
	glyph?: string;
}

const KNOWN_UNITS: Record<string, UnitMeta> = {
	sat: {code: 'sat', decimals: 0, divisor: 1, family: 'btc', glyph: '₿'},
	msat: {code: 'sat', decimals: 0, divisor: 1000, family: 'btc', glyph: '₿'},
	btc: {code: 'BTC', decimals: 8, divisor: 1, family: 'btc', glyph: '₿'},
	usd: {code: 'USD', decimals: 2, divisor: 100, family: 'fiat', glyph: '$'},
	eur: {code: 'EUR', decimals: 2, divisor: 100, family: 'fiat', glyph: '€'},
	auth: {code: 'auth', decimals: 0, divisor: 1, family: 'custom'},
};

/**
 * Looks up display metadata for a Cashu unit.
 * Units are free-form strings, so anything Orchard has no entry for is treated as a whole-number custom unit.
 * @param {string} unit - The unit as advertised by the mint
 * @returns {UnitMeta} Display metadata for the unit
 */
export function getUnitMeta(unit: string): UnitMeta {
	const unit_lower = unit?.toLowerCase() ?? '';
	return KNOWN_UNITS[unit_lower] ?? {code: unit_lower, decimals: 0, divisor: 1, family: 'custom'};
}

/**
 * Converts an amount from the unit's stored base units to its display units.
 * @param {string} unit - The unit the amount is denominated in
 * @param {number} amount - The amount in base units
 * @returns {number} The amount in display units
 */
export function toDisplayAmount(unit: string, amount: number): number {
	const meta = getUnitMeta(unit);
	if (meta.divisor === 1) return amount;
	/* Whole-number units round up to the next display unit; fractional units keep their remainder */
	return meta.decimals === 0 ? Math.ceil(amount / meta.divisor) : amount / meta.divisor;
}
