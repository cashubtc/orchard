/* Core Dependencies */
import {Component, ChangeDetectionStrategy, inject, signal, DestroyRef} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {finalize} from 'rxjs';

/* Application Dependencies */
import {FORM_PANEL_DATA, FormPanelRef} from '@client/modules/form/services/form-panel';
import {OrchardErrors} from '@client/modules/error/classes/error.class';

/* Native Dependencies */
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {ServiceFieldsComponent} from '@client/modules/service-config/components/service-fields/service-fields.component';
import {ServiceCheckResultComponent} from '@client/modules/service-config/components/service-check-result/service-check-result.component';
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';
import {createServiceForm, serviceFormInput} from '@client/modules/service-config/helpers/service-config.helpers';

/* Shared Dependencies */
import type {OrchardServiceConfiguration, OrchardConnectionCheck} from '@shared/generated.types';

@Component({
	selector: 'orc-service-editor',
	imports: [MatButtonModule, MatIconModule, MatProgressBarModule, ServiceFieldsComponent, ServiceCheckResultComponent],
	templateUrl: './service-editor.component.html',
	styleUrl: './service-editor.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceEditorComponent {
	private readonly serviceConfigService = inject(ServiceConfigService);
	private readonly panel = inject(FormPanelRef<boolean>);
	private readonly destroy_ref = inject(DestroyRef);

	public readonly configuration: OrchardServiceConfiguration = inject(FORM_PANEL_DATA);
	public readonly descriptor = SERVICE_DESCRIPTORS[this.configuration.service];
	public readonly form = createServiceForm(this.configuration);
	public readonly result = signal<OrchardConnectionCheck | null>(null);
	public readonly busy = signal(false);
	public readonly error = signal<string | null>(null);
	public readonly saved = signal(false);

	/* *******************************************************
        Actions
    ******************************************************** */

	/** Test or save the current form, with an explicit bypass for an unreachable node. */
	public submit(save: boolean, save_unreachable = false): void {
		if (this.busy()) return;
		this.busy.set(true);
		this.error.set(null);
		const input = serviceFormInput(this.configuration, this.form);
		this.form.disable({emitEvent: false});
		const request = save ? this.serviceConfigService.save(input, save_unreachable) : this.serviceConfigService.test(input);
		request
			.pipe(
				takeUntilDestroyed(this.destroy_ref),
				finalize(() => {
					this.busy.set(false);
					this.form.enable({emitEvent: false});
				}),
			)
			.subscribe({
				next: (result) => {
					this.result.set(result);
					this.saved.set(save && (result.ok || save_unreachable));
				},
				error: (error: unknown) =>
					this.error.set(
						(error instanceof OrchardErrors && error.errors[0]?.message) || 'The configuration request could not be completed.',
					),
			});
	}

	/** A changed field invalidates the preceding test and save-anyway offer. */
	public changed(): void {
		this.result.set(null);
		this.saved.set(false);
	}

	/** Close the panel and refresh the list after an applied change. */
	public close(): void {
		this.panel.close(this.saved());
	}
}
