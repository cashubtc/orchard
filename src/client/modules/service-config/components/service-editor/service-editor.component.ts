/* Core Dependencies */
import {Component, ChangeDetectionStrategy, inject} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

/* Application Dependencies */
import {FORM_PANEL_DATA, FormPanelRef} from '@client/modules/form/services/form-panel';

/* Native Dependencies */
import {ServiceFormService} from '@client/modules/service-config/services/service-form.service';
import {ServiceFieldsComponent} from '@client/modules/service-config/components/service-fields/service-fields.component';
import {ServiceCheckResultComponent} from '@client/modules/service-config/components/service-check-result/service-check-result.component';
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';

/* Shared Dependencies */
import type {OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-service-editor',
	providers: [ServiceFormService],
	imports: [MatButtonModule, MatIconModule, MatProgressBarModule, ServiceFieldsComponent, ServiceCheckResultComponent],
	templateUrl: './service-editor.component.html',
	styleUrl: './service-editor.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceEditorComponent {
	private readonly connection = inject(ServiceFormService);
	private readonly panel = inject(FormPanelRef<boolean>);

	public readonly configuration: OrchardServiceConfiguration = inject(FORM_PANEL_DATA);
	public readonly descriptor = SERVICE_DESCRIPTORS[this.configuration.service];
	public readonly form = this.connection.initialize(this.configuration);
	public readonly result = this.connection.result;
	public readonly busy = this.connection.busy;
	public readonly error = this.connection.error;
	public readonly saved = this.connection.saved;

	/* *******************************************************
        Actions
    ******************************************************** */

	/** Test or save the current form, with an explicit bypass for an unreachable node. */
	public submit(save: boolean, save_unreachable = false): void {
		this.connection.submit(save, save_unreachable).subscribe();
	}

	/** A changed field invalidates the preceding test and save-anyway offer. */
	public changed(): void {
		this.connection.changed();
	}

	/** Close the panel and refresh the list after an applied change. */
	public close(): void {
		this.panel.close(this.saved());
	}
}
