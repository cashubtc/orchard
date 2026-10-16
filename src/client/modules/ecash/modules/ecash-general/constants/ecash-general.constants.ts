/* Native Dependencies */
import {
	EcashActivityKind,
	EcashMintAddIcon,
	EcashMintAddState,
	EcashSolvencyVerdict,
} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
/* Shared Dependencies */
import {WalletOperationType} from '@shared/generated.types';

export const ACTIVITY_RECENT_COUNT = 8;

export const ACTIVITY_KINDS: Record<WalletOperationType, EcashActivityKind> = {
	[WalletOperationType.Issue]: {
		method: {label: 'Ecash', icon: 'payments', svg_icon: false},
		titles: {done: 'Issued', open: 'Issuing', failed: 'Issue failed'},
	},
	[WalletOperationType.Mint]: {
		titles: {done: 'Received', open: 'Receiving', failed: 'Receive failed'},
	},
};

export const MINT_TIME_SYNC_S = 60;

export const MINT_ADD_HINTS: Partial<Record<EcashMintAddState, string>> = {
	found: 'Mint online. Review it before adding.',
	sign_in: 'Mint online, but it requires sign-in.',
	exists: 'Already in your wallet.',
};

export const MINT_ADD_ICONS: Partial<Record<EcashMintAddState, EcashMintAddIcon>> = {
	found: {icon: 'check_circle', color: 'orc-status-active-color'},
	joins: {icon: 'check_circle', color: 'orc-status-active-color'},
	sign_in: {icon: 'lock', color: 'orc-status-warning-color'},
	exists: {icon: 'info', color: 'orc-outline-color'},
	error: {icon: 'error', color: 'orc-error-color'},
};

export const BALANCE_COUNT_MS = 1100;
export const BALANCE_DIGIT_EM = 0.665;
export const BALANCE_SEPARATOR_EM = 0.24;

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
