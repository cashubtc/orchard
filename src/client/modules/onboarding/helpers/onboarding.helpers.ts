/* Core Dependencies */
import type {ActivatedRouteSnapshot} from '@angular/router';

/* Application Dependencies */
import {serviceConfigurationDetail} from '@client/modules/service-config/helpers/service-config.helpers';

/* Native Dependencies */
import {ONBOARDING_COPY, ONBOARDING_REVIEW_STATUS, ONBOARDING_SERVICES} from '@client/modules/onboarding/constants/onboarding.constants';
import type {OnboardingOutcomes, OnboardingReviewRow, OnboardingRoute} from '@client/modules/onboarding/types/onboarding.types';

/* Shared Dependencies */
import type {OrchardServiceConfiguration, ServiceKind} from '@shared/generated.types';

/** Recognize only supported services in direct first-run links. */
export function onboardingService(value: string | null): ServiceKind | null {
	return ONBOARDING_SERVICES.find((service) => service === value) ?? null;
}

/** Read the wizard's step, service, picked services and return target from the onboarding route's URL. */
export function onboardingRoute(snapshot: ActivatedRouteSnapshot): OnboardingRoute {
	const service = onboardingService(snapshot.firstChild?.paramMap.get('service') ?? null);
	const picked = snapshot.queryParamMap.get('picked')?.split(',');
	return {
		stage: snapshot.firstChild?.data['stage'] === 'review' ? 'review' : service ? 'configure' : 'services',
		service,
		picked: picked ? ONBOARDING_SERVICES.filter((item) => picked.includes(item)) : null,
		return_to_review: snapshot.queryParamMap.get('return') === 'review',
	};
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
		const detail = serviceConfigurationDetail(configuration, saved?.chain, saved?.mode);
		const status =
			configuration.source === 'environment'
				? 'environment'
				: configuration.status in ONBOARDING_REVIEW_STATUS
					? configuration.status
					: 'untested';
		return {service, detail, enabled: true, ...ONBOARDING_REVIEW_STATUS[status]};
	});
}
