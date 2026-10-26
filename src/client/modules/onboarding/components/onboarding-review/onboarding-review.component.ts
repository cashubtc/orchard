/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';

/* Native Dependencies */
import {OnboardingLayoutService} from '@client/modules/onboarding/services/onboarding-layout.service';
import type {OnboardingReviewRow} from '@client/modules/onboarding/types/onboarding.types';

/* Shared Dependencies */
import type {ServiceKind} from '@shared/generated.types';

@Component({
	host: {'[class.mobile]': 'mobile()'},
	selector: 'orc-onboarding-review',
	imports: [MatButtonModule, MatIconModule],
	templateUrl: './onboarding-review.component.html',
	styleUrl: './onboarding-review.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingReviewComponent {
	private readonly layout = inject(OnboardingLayoutService);
	public readonly mobile = this.layout.mobile;
	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly rows = input.required<OnboardingReviewRow[]>();
	public readonly setup_mode = input<boolean>(false);
	public readonly busy = input<boolean>(false);
	public readonly edited = output<ServiceKind>();
	public readonly backed = output<void>();
	public readonly opened = output<void>();
}
