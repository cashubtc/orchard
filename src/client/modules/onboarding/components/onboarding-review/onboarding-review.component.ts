/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Native Dependencies */
import {OnboardingLayoutService} from '@client/modules/onboarding/services/onboarding-layout.service';
import {ONBOARDING_DESCRIPTORS} from '@client/modules/onboarding/constants/onboarding.constants';
import type {OnboardingChoice, OnboardingReviewRow} from '@client/modules/onboarding/types/onboarding.types';

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
	public readonly descriptors = ONBOARDING_DESCRIPTORS;
	public readonly rows = input.required<OnboardingReviewRow[]>();
	public readonly setup_mode = input<boolean>(false);
	public readonly busy = input<boolean>(false);
	public readonly edited = output<OnboardingChoice>();
	public readonly backed = output<void>();
	public readonly opened = output<void>();
}
