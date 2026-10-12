/* Application Dependencies */
import {GraphicStatusState} from '@client/modules/graphic/types/graphic-status.types';

/** A unit to offer, with the balance shown unless the chips show unit names */
export type EcashUnitChip = {
	unit: string;
	amount?: number;
};

/** Whether a mint's reserves cover its liabilities */
export type EcashSolvencyVerdict = 'backed' | 'short' | 'unknown';

/** A mint's status pill, with the reason it is unreachable */
export type EcashMintStatusPill = {
	state: GraphicStatusState;
	text: string;
	error: string | null;
};
