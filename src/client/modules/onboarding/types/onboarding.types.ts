/* Shared Dependencies */
import type {OrchardConnectionCheck, ServiceKind} from '@shared/generated.types';

export type OnboardingStage = 'services' | 'configure' | 'review';
export type OnboardingTone = 'neutral' | 'success' | 'warning';
/** Connection services plus the ecash wallet, which is a stored toggle rather than a connection. */
export type OnboardingChoice = ServiceKind | 'ecash';
export interface OnboardingStageCopy {
	title: string;
	intro: string | null;
	step: number;
}
export interface OnboardingDescriptor {
	name: string;
	icon: string;
}
export interface OnboardingRoute {
	stage: OnboardingStage;
	service: ServiceKind | null;
	picked: OnboardingChoice[] | null;
	return_to_review: boolean;
}
export interface OnboardingOutcome {
	check?: OrchardConnectionCheck;
	saved_check?: OrchardConnectionCheck;
	skipped?: boolean;
}
export type OnboardingOutcomes = Partial<Record<ServiceKind, OnboardingOutcome>>;
export interface OnboardingReviewStatus {
	status: string;
	tone: OnboardingTone;
	icon: string;
}
export interface OnboardingReviewRow extends OnboardingReviewStatus {
	service: OnboardingChoice;
	detail: string;
	enabled: boolean;
	action: string;
}

export interface OnboardingChoiceCopy {
	description: string;
	note: string;
	tile: string;
	skipped: string;
}
export interface OnboardingServiceCopy extends OnboardingChoiceCopy {
	configure: string;
}
