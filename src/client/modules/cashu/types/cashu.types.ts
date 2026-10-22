/** How a payment method is shown: its label and icon */
export type CashuMethodDisplay = {
	label: string;
	icon: string;
	svg_icon: boolean;
};

/** A unit to offer, with the balance shown unless the chips show unit names */
export type CashuUnitChip = {
	unit: string;
	amount?: number;
};

/** A payment method to offer, with how it's shown */
export type CashuMethodChip = {
	method: string;
	display: CashuMethodDisplay;
};

/** One method and unit's bounds for minting or melting, in the unit's base units; null when the mint sets none */
export type CashuLimit = {
	method: string;
	unit: string;
	min_amount: number | null;
	max_amount: number | null;
};
