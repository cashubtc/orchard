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
import type {EcashSeed} from '@client/modules/ecash/classes/ecash-seed.class';

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

/** What the backup panel reads from its host: the seed's backup status and the mints a restore needs */
export type EcashBackupPanelData = {
	seed: EcashSeed | null;
	mints: EcashMint[];
};

/** A protocol feature and whether a mint offers it */
export type EcashMintFeature = {
	label: string;
	nut: string;
	supported: boolean;
};

/** Where an operation stands: settled, still running, or given up */
export type EcashActivityProgress = 'done' | 'open' | 'failed';

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
