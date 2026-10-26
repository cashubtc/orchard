/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';

/* Native Dependencies */
import {OnboardingLayoutService} from '@client/modules/onboarding/services/onboarding-layout.service';
import {ONBOARDING_COPY, ONBOARDING_SERVICES} from '@client/modules/onboarding/constants/onboarding.constants';

/* Shared Dependencies */
import type {ServiceKind} from '@shared/generated.types';

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
	public readonly services = ONBOARDING_SERVICES;
	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly copy = ONBOARDING_COPY;
	public readonly selected = input.required<ServiceKind[]>();
	public readonly toggled = output<ServiceKind>();
	public readonly continued = output<void>();
	public readonly skipped = output<void>();
}
