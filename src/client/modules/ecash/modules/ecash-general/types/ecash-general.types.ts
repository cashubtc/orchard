/* Core Dependencies */
import type {Signal} from '@angular/core';
/* Application Dependencies */
import {GraphicStatusState} from '@client/modules/graphic/types/graphic-status.types';
import type {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import type {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import type {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';

/** A unit to offer, with the balance shown unless the chips show unit names */
export type EcashUnitChip = {
	unit: string;
	amount?: number;
};

/** One character of a typed amount; ghosts are the zeros still to be typed */
export type EcashAmountChar = {
	char: string;
	ghost: boolean;
};

/** One character of a counting balance, in a cell as wide as its widest glyph so the number holds still */
export type EcashBalanceCell = {
	char: string;
	width: number;
};

/** Whether a mint's reserves cover its liabilities */
export type EcashSolvencyVerdict = 'backed' | 'short' | 'none' | 'unknown';

/** A mint's status pill, with the reason it is unreachable */
export type EcashMintStatusPill = {
	state: GraphicStatusState;
	text: string;
	error: string | null;
};

/** What the issue panel reads from the wallet page, live, and the unit it opens in */
export type EcashIssuePanelData = {
	mint: EcashMint;
	reserves: Signal<MintReserves | null>;
	status: Signal<EcashMintStatusPill>;
	balances: Signal<EcashBalance[]>;
	unit: string | null;
};
