/* Shared Dependencies */
import type {OrchardConnectionCheck, ServiceKind} from '@shared/generated.types';

export type OnboardingStage = 'services' | 'configure' | 'review';
export type OnboardingTone = 'neutral' | 'success' | 'warning';
export interface OnboardingStageCopy {
	title: string;
	intro: string | null;
	step: number;
}
export interface OnboardingRoute {
	stage: OnboardingStage;
	service: ServiceKind | null;
	picked: ServiceKind[] | null;
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
	service: ServiceKind;
	detail: string;
	enabled: boolean;
}

export interface OnboardingServiceCopy {
	description: string;
	note: string;
	tile: string;
	configure: string;
	skipped: string;
}
