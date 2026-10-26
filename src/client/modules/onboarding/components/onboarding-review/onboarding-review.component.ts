/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';

/* Native Dependencies */
import type {OnboardingReviewRow} from '@client/modules/onboarding/types/onboarding.types';

/* Shared Dependencies */
import type {ServiceKind} from '@shared/generated.types';

@Component({
	selector: 'orc-onboarding-review',
	imports: [MatButtonModule, MatIconModule],
	templateUrl: './onboarding-review.component.html',
	styleUrl: './onboarding-review.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingReviewComponent {
	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly rows = input.required<OnboardingReviewRow[]>();
	public readonly setup_mode = input(false);
	public readonly busy = input(false);
	public readonly edited = output<ServiceKind>();
	public readonly backed = output<void>();
	public readonly opened = output<void>();
}
