/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatProgressBarModule} from '@angular/material/progress-bar';

/* Application Dependencies */
import type {ServiceForm} from '@client/modules/service-config/types/service-config.types';
import {ServiceFormService} from '@client/modules/service-config/services/service-form.service';
import {ServiceFieldsComponent} from '@client/modules/service-config/components/service-fields/service-fields.component';
import {ServiceCheckResultComponent} from '@client/modules/service-config/components/service-check-result/service-check-result.component';
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';

/* Native Dependencies */
import {ONBOARDING_COPY} from '@client/modules/onboarding/constants/onboarding.constants';

/* Shared Dependencies */
import type {OrchardServiceConfiguration, OrchardConnectionCheck} from '@shared/generated.types';

@Component({
	selector: 'orc-onboarding-configure',
	providers: [ServiceFormService],
	imports: [MatButtonModule, MatProgressBarModule, ServiceFieldsComponent, ServiceCheckResultComponent],
	templateUrl: './onboarding-configure.component.html',
	styleUrl: './onboarding-configure.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingConfigureComponent implements OnInit {
	private readonly connection = inject(ServiceFormService);

	public readonly copy = ONBOARDING_COPY;
	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly configuration = input.required<OrchardServiceConfiguration>();
	public readonly pending = input(false);
	public readonly checked = output<OrchardConnectionCheck | undefined>();
	public readonly applied = output<OrchardConnectionCheck>();
	public readonly skipped = output<void>();
	public readonly backed = output<void>();
	public readonly result = this.connection.result;
	public readonly error = this.connection.error;
	public readonly busy = computed(() => this.connection.busy() || this.pending());
	public form!: ServiceForm;

	/** Prepare the shared form once the configuration input is available. */
	public ngOnInit(): void {
		this.form = this.connection.initialize(this.configuration());
	}

	/* *******************************************************
        Form actions
    ******************************************************** */

	/** Apply each successful save immediately before moving to the next service. */
	public submit(save: boolean, save_unreachable = false): void {
		if (this.busy()) return;
		this.connection.submit(save, save_unreachable).subscribe((result) => {
			this.checked.emit(result);
			if (this.connection.saved()) this.applied.emit(result);
		});
	}

	/** Clear stale field flags and the corresponding side-list result when edited. */
	public changed(): void {
		this.connection.changed();
		this.checked.emit(undefined);
	}
}
