/* Core Dependencies */
import type {Signal} from '@angular/core';
/* Application Dependencies */
import {GraphicStatusState} from '@client/modules/graphic/types/graphic-status.types';
import type {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
import type {CashuMethodDisplay} from '@client/modules/cashu/types/cashu.types';
/* Native Dependencies */
import type {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import type {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import type {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';

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

/** What the add-mint panel reads from the wallet page, live */
export type EcashMintAddPanelData = {
	mints: Signal<EcashMint[]>;
};

/** Where an add-mint lookup stands: a new mint (needing sign-in or not), a new URL joining a wallet mint, or a URL already in the wallet */
export type EcashMintAddState = 'idle' | 'loading' | 'error' | 'found' | 'sign_in' | 'joins' | 'exists';

/** The icon beside the mint URL for a lookup state, with its colour class */
export type EcashMintAddIcon = {icon: string; color: string};

/** One method and unit a mint mints or melts, with its bounds in the unit's base units */
export type EcashMintLimit = {
	method: CashuMethodDisplay;
	unit: string;
	min: number | null;
	max: number | null;
};

/** A mint's limits for minting or for melting */
export type EcashMintLimitGroup = {
	label: string;
	limits: EcashMintLimit[];
};

/** A protocol feature and whether a mint offers it */
export type EcashMintFeature = {
	label: string;
	nut: string;
	supported: boolean;
};

/** Where an operation stands: settled, still running, or given up */
export type EcashActivityProgress = 'done' | 'open' | 'failed';

/** How a kind of operation reads in the activity list; without a method it shows the operation's payment method */
export type EcashActivityKind = {
	method?: CashuMethodDisplay;
	titles: Record<EcashActivityProgress, string>;
};

/** One operation laid out for its activity row */
export type EcashActivityRow = {
	operation: EcashOperation;
	time: string;
	title: string;
	subtitle: string | null;
	method: CashuMethodDisplay;
	progress: EcashActivityProgress;
	amount_oracle: number | null;
};

/** Operations from one day, or from one month once they are over a week old */
export type EcashActivityGroup = {
	key: string;
	label: string;
	rows: EcashActivityRow[];
};
