/* Application Dependencies */
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';

/* Native Dependencies */
import {
	ONBOARDING_COPY,
	ONBOARDING_MODE_LABELS,
	ONBOARDING_REVIEW_STATUS,
	ONBOARDING_SERVICES,
} from '@client/modules/onboarding/constants/onboarding.constants';
import type {OnboardingOutcomes, OnboardingReviewRow} from '@client/modules/onboarding/types/onboarding.types';

/* Shared Dependencies */
import type {OrchardServiceConfiguration, ServiceKind} from '@shared/generated.types';

/** Recognize only supported services in direct first-run links. */
export function onboardingService(value: string | null): ServiceKind | null {
	return ONBOARDING_SERVICES.find((service) => service === value) ?? null;
}

/** Members open the federation dashboard; the mint section sends setup and unreachable daemons to setup itself. */
export function onboardingDestination(mode: string | null): string {
	return mode === 'member' ? '/mint/federation' : '/mint';
}

/** Summarize applied connections, keeping skipped and untested services neutral. */
export function onboardingReview(configurations: OrchardServiceConfiguration[], outcomes: OnboardingOutcomes): OnboardingReviewRow[] {
	return ONBOARDING_SERVICES.map((service) => {
		const configuration = configurations.find((item) => item.service === service);
		if (!configuration?.enabled)
			return {service, detail: ONBOARDING_COPY[service].skipped, enabled: false, ...ONBOARDING_REVIEW_STATUS['skipped']};
		const saved = outcomes[service]?.saved_check;
		const value = (key: string): string => configuration.fields.find((field) => field.key === key)?.value ?? '';
		const type = SERVICE_DESCRIPTORS[service].types.find((item) => item.value === configuration.type)?.label ?? configuration.type;
		const network = saved?.chain || (saved?.mode ? (ONBOARDING_MODE_LABELS[saved.mode] ?? saved.mode) : null);
		const detail = [type, `${value('host')}:${value('port')}`, network].filter(Boolean).join(' · ');
		const status =
			configuration.source === 'environment'
				? 'environment'
				: configuration.status in ONBOARDING_REVIEW_STATUS
					? configuration.status
					: 'untested';
		return {service, detail, enabled: true, ...ONBOARDING_REVIEW_STATUS[status]};
	});
}
