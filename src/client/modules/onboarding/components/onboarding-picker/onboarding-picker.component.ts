/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Native Dependencies */
import {OnboardingLayoutService} from '@client/modules/onboarding/services/onboarding-layout.service';
import {ONBOARDING_CHOICES, ONBOARDING_COPY, ONBOARDING_DESCRIPTORS} from '@client/modules/onboarding/constants/onboarding.constants';
import type {OnboardingChoice} from '@client/modules/onboarding/types/onboarding.types';

@Component({
	host: {'[class.mobile]': 'mobile()'},
	selector: 'orc-onboarding-picker',
	imports: [MatButtonModule, MatIconModule],
	templateUrl: './onboarding-picker.component.html',
	styleUrl: './onboarding-picker.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingPickerComponent {
	private readonly layout = inject(OnboardingLayoutService);
	public readonly mobile = this.layout.mobile;
	public readonly services = ONBOARDING_CHOICES;
	public readonly descriptors = ONBOARDING_DESCRIPTORS;
	public readonly copy = ONBOARDING_COPY;
	public readonly selected = input.required<OnboardingChoice[]>();
	public readonly toggled = output<OnboardingChoice>();
	public readonly continued = output<void>();
	public readonly skipped = output<void>();
}
