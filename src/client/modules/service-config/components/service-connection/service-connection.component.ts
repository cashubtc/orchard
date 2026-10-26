/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

/* Native Dependencies */
import {ServiceFormService} from '@client/modules/service-config/services/service-form.service';
import {ServiceFieldsComponent} from '@client/modules/service-config/components/service-fields/service-fields.component';
import {ServiceCheckResultComponent} from '@client/modules/service-config/components/service-check-result/service-check-result.component';
import {ServiceRefreshAlertComponent} from '@client/modules/service-config/components/service-refresh-alert/service-refresh-alert.component';
import {serviceAppliedConfiguration, serviceEnvironmentPrefix} from '@client/modules/service-config/helpers/service-config.helpers';
import type {ServiceApplied, ServiceForm} from '@client/modules/service-config/types/service-config.types';

/* Shared Dependencies */
import type {OrchardConnectionCheck, OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-service-connection',
	providers: [ServiceFormService],
	imports: [
		MatButtonModule,
		MatIconModule,
		MatProgressBarModule,
		ServiceFieldsComponent,
		ServiceCheckResultComponent,
		ServiceRefreshAlertComponent,
	],
	templateUrl: './service-connection.component.html',
	styleUrl: './service-connection.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceConnectionComponent implements OnInit {
	private readonly connection = inject(ServiceFormService);

	public form!: ServiceForm;

	public readonly configuration = input.required<OrchardServiceConfiguration>();
	public readonly pending = input<boolean>(false);
	public readonly context = input<'settings' | 'onboarding'>('settings');
	public readonly checked = output<OrchardConnectionCheck | undefined>();
	public readonly applied = output<ServiceApplied>();
	public readonly backed = output<void>();
	public readonly skipped = output<void>();
	public readonly done = output<void>();
	public readonly result = this.connection.result;
	public readonly saved = this.connection.saved;
	public readonly error = this.connection.error;

	public readonly environment_prefix = computed<string>(() => serviceEnvironmentPrefix(this.configuration().service));
	public readonly busy = computed<boolean>(() => this.connection.busy() || this.pending());
	public readonly failed = computed<boolean>(() => !!this.result() && !this.result()!.ok);
	public readonly setup_note = computed<string | null>(() => {
		if (this.result()?.mode !== 'setup') return null;
		const next = this.context() === 'onboarding' ? ' Orchard opens Federation setup after Review.' : '';
		return `This mint is in federation setup mode and won't serve wallets until you create or join a federation.${next}`;
	});

	/** Prepare the shared connection form after its configuration is bound. */
	public ngOnInit(): void {
		this.form = this.connection.initialize(this.configuration());
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Share tests and confirmed saves between onboarding and Settings, emitting what a save applied. */
	public submit(save: boolean, save_unreachable = false): void {
		if (this.busy()) return;
		this.connection.submit(save, save_unreachable).subscribe((check) => {
			this.checked.emit(check);
			if (this.saved()) this.applied.emit({check, configuration: serviceAppliedConfiguration(this.configuration(), this.form)});
		});
	}

	/** Clear a previous result when the draft changes. */
	public changed(): void {
		this.connection.changed();
		this.checked.emit(undefined);
	}
}
