/* Shared Dependencies */
import type {OrchardConnectionCheck, ServiceKind} from '@shared/generated.types';

export type OnboardingStage = 'services' | 'configure' | 'review';
export type OnboardingTone = 'neutral' | 'success' | 'warning';
export interface OnboardingStageCopy {
	title: string;
	intro: string | null;
	step: number;
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
