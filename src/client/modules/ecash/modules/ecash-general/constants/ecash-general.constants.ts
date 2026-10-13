/* Native Dependencies */
import {EcashSolvencyVerdict} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

export const SOLVENCY_VERDICTS: Record<
	EcashSolvencyVerdict,
	{icon: string; label: string; impact_label?: string; short_before_label?: string}
> = {
	backed: {icon: 'check', label: 'Fully backed', impact_label: 'Still fully backed'},
	short: {
		icon: 'error',
		label: 'Not fully backed',
		impact_label: 'Not fully backed after this',
		short_before_label: 'Currently not fully backed',
	},
	none: {icon: 'tune', label: 'No assets selected'},
	unknown: {icon: 'warning', label: 'Assets unavailable'},
};
