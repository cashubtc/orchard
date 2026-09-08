export type UnitFamily = 'btc' | 'fiat' | 'custom';

/** Presentation identity of a unit. Matches the `--orc-asset-*` tokens and the `graphic-asset-*` / `coin-*` classes. */
export type UnitAsset = 'btc' | 'usd' | 'eur' | 'custom';

export interface UnitMeta {
	/** Label to render alongside an amount */
	code: string;
	/** Fraction digits to display */
	decimals: number;
	/** Base units stored per display unit */
	divisor: number;
	family: UnitFamily;
	asset: UnitAsset;
	/** Material symbol representing the unit */
	icon: string;
	/** Currency symbol, where the unit has one */
	glyph?: string;
}
