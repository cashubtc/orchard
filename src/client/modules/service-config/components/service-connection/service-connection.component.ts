/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';

/* Native Dependencies */
import {ServiceFormService} from '@client/modules/service-config/services/service-form.service';
import {ServiceFieldsComponent} from '@client/modules/service-config/components/service-fields/service-fields.component';
import {ServiceCheckResultComponent} from '@client/modules/service-config/components/service-check-result/service-check-result.component';
import {ServiceRefreshAlertComponent} from '@client/modules/service-config/components/service-refresh-alert/service-refresh-alert.component';
import {serviceAppliedConfiguration} from '@client/modules/service-config/helpers/service-config.helpers';
import type {ServiceApplied, ServiceForm} from '@client/modules/service-config/types/service-config.types';

/* Shared Dependencies */
import type {OrchardConnectionCheck, OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-service-connection',
	providers: [ServiceFormService],
	imports: [
		MatButtonModule,
		MatIconModule,
		MatProgressSpinnerModule,
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

	public readonly busy = computed<boolean>(() => this.connection.busy() || this.pending());
	public readonly failed = computed<boolean>(() => !!this.result() && !this.result()!.ok);
	// A failure pinned to one field explains itself under that field; several share a generic prompt
	public readonly flag_message = computed<string | null>(() => {
		const result = this.result();
		return result?.fields.length === 1 && result.diagnostic ? result.diagnostic : null;
	});
	public readonly testing = computed<boolean>(() => this.connection.busy() && this.action() === 'test');
	public readonly saving = computed<boolean>(() => this.connection.busy() && this.action() === 'save');
	// After a failed test the same button saves without a working connection and reads "Save anyway" instead
	public readonly save_label = computed<string>(() => {
		if (this.context() === 'onboarding') return 'Save and continue';
		return this.configuration().source === 'environment' ? 'Save to Orchard' : 'Save connection';
	});

	// Which request is running, so only the button that started it shows progress
	private readonly action = signal<'test' | 'save' | null>(null);

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
		this.action.set(save ? 'save' : 'test');
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
