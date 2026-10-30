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
