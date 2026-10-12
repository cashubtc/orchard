/* Native Dependencies */
import {EcashSolvencyVerdict} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

export const SOLVENCY_VERDICTS: Record<EcashSolvencyVerdict, {icon: string; label: string}> = {
	backed: {icon: 'check', label: 'Fully backed'},
	short: {icon: 'error', label: 'Not fully backed'},
	unknown: {icon: 'warning', label: 'Reserves unavailable'},
};
