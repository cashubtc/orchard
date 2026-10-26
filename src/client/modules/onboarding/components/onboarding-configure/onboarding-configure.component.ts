/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output, viewChild} from '@angular/core';

/* Application Dependencies */
import {ServiceConnectionComponent} from '@client/modules/service-config/components/service-connection/service-connection.component';
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';

/* Native Dependencies */
import {ONBOARDING_COPY} from '@client/modules/onboarding/constants/onboarding.constants';

/* Shared Dependencies */
import type {OrchardServiceConfiguration, OrchardConnectionCheck} from '@shared/generated.types';

@Component({
	selector: 'orc-onboarding-configure',
	imports: [ServiceConnectionComponent],
	templateUrl: './onboarding-configure.component.html',
	styleUrl: './onboarding-configure.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingConfigureComponent {
	public readonly copy = ONBOARDING_COPY;
	public readonly descriptors = SERVICE_DESCRIPTORS;

	public readonly configuration = input.required<OrchardServiceConfiguration>();
	public readonly pending = input<boolean>(false);
	public readonly checked = output<OrchardConnectionCheck | undefined>();
	public readonly applied = output<OrchardConnectionCheck>();
	public readonly skipped = output<void>();
	public readonly backed = output<void>();

	public readonly busy = computed<boolean>(() => this.connection()?.busy() ?? this.pending());

	private readonly connection = viewChild(ServiceConnectionComponent);
}
