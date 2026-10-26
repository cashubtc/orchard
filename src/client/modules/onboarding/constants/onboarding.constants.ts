/* Application Dependencies */
import {
	SERVICE_SOURCE_LABELS,
	SERVICE_STATUS_ICONS,
	SERVICE_STATUS_LABELS,
} from '@client/modules/service-config/constants/service-config.constants';

/* Native Dependencies */
import type {
	OnboardingReviewStatus,
	OnboardingStage,
	OnboardingStageCopy,
	OnboardingServiceCopy,
} from '@client/modules/onboarding/types/onboarding.types';

/* Shared Dependencies */
import {ServiceKind} from '@shared/generated.types';

export const ONBOARDING_SERVICES = [ServiceKind.Bitcoin, ServiceKind.Lightning, ServiceKind.Mint];
export const ONBOARDING_STEPS = ['Account', 'Services', 'Configure', 'Review'];
export const ONBOARDING_STAGES: Record<OnboardingStage, OnboardingStageCopy> = {
	services: {
		title: 'Set up Orchard',
		intro: 'Choose what this Orchard manages. You can add, change or remove a service later in Settings.',
		step: 1,
	},
	configure: {title: 'Configure your services', intro: null, step: 2},
	review: {title: 'Review your setup', intro: 'Your saved connections are already applied. Nothing needs a restart.', step: 3},
};
export const ONBOARDING_COPY: Record<ServiceKind, OnboardingServiceCopy> = {
	bitcoin: {
		description: 'A Bitcoin Core node. Blocks, fee estimates and the price oracle.',
		note: 'Bitcoin Core RPC',
		tile: 'A Bitcoin Core node: blocks, fees and the mempool.',
		configure: "Connect to Bitcoin Core's RPC. Orchard reads blocks, fee estimates and the mempool from it.",
		skipped: 'Optional · add this service whenever you need it',
	},
	lightning: {
		description: 'A Lightning node to manage here. Channels, liquidity and payments.',
		note: 'LND or Core Lightning · not needed to run a mint',
		tile: 'LND or Core Lightning. Not needed to run a mint.',
		configure:
			"Connect a Lightning node to manage its channels, liquidity and payments in Orchard. Your mint keeps its own connection to its payment backend, so it doesn't depend on this one.",
		skipped: 'Optional · your mint takes payments through its own backend',
	},
	mint: {
		description: 'A Cashu mint, standalone or a member of a federated CDK mint. It pays through its own backend.',
		note: 'CDK or Nutshell management RPC',
		tile: 'CDK or Nutshell, standalone or a federation member.',
		configure: "Connect to your mint's management RPC. Orchard detects whether it's a standalone mint or part of a federation.",
		skipped: 'Optional · add this service whenever you need it',
	},
};
// Keyed by the server's connection status, plus the states only Review shows
export const ONBOARDING_REVIEW_STATUS: Record<string, OnboardingReviewStatus> = {
	connected: {status: SERVICE_STATUS_LABELS['connected'], tone: 'success', icon: SERVICE_STATUS_ICONS['connected']},
	warning: {status: SERVICE_STATUS_LABELS['warning'], tone: 'warning', icon: SERVICE_STATUS_ICONS['warning']},
	unreachable: {status: 'Saved without a working connection', tone: 'warning', icon: SERVICE_STATUS_ICONS['unreachable']},
	environment: {status: SERVICE_SOURCE_LABELS['environment'], tone: 'neutral', icon: 'info'},
	untested: {status: 'Saved in Orchard · not tested this session', tone: 'neutral', icon: 'info'},
	skipped: {status: 'Skipped', tone: 'neutral', icon: 'do_not_disturb_on'},
};
