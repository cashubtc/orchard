/* Core Dependencies */
import {Component, ChangeDetectionStrategy, DestroyRef, computed, inject, signal, viewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatDialog} from '@angular/material/dialog';
import {finalize} from 'rxjs';

/* Application Dependencies */
import {FORM_PANEL_DATA, FormPanelRef} from '@client/modules/form/services/form-panel';

/* Native Dependencies */
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {ServiceConnectionComponent} from '@client/modules/service-config/components/service-connection/service-connection.component';
import {ServiceRefreshAlertComponent} from '@client/modules/service-config/components/service-refresh-alert/service-refresh-alert.component';
import {ServiceRemoveDialogComponent} from '@client/modules/service-config/components/service-remove-dialog/service-remove-dialog.component';
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';
import {serviceErrorMessage} from '@client/modules/service-config/helpers/service-config.helpers';
import type {ServiceApplied} from '@client/modules/service-config/types/service-config.types';

/* Shared Dependencies */
import type {OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-service-editor',
	imports: [MatButtonModule, MatIconModule, ServiceConnectionComponent, ServiceRefreshAlertComponent],
	templateUrl: './service-editor.component.html',
	styleUrl: './service-editor.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceEditorComponent {
	private readonly serviceConfigService = inject(ServiceConfigService);
	private readonly panel = inject(FormPanelRef<boolean>);
	private readonly dialog = inject(MatDialog);
	private readonly destroy_ref = inject(DestroyRef);

	public readonly configuration: OrchardServiceConfiguration = inject(FORM_PANEL_DATA);
	public readonly descriptor = SERVICE_DESCRIPTORS[this.configuration.service];

	public readonly effective_configuration = signal<OrchardServiceConfiguration>(this.configuration);
	public readonly removing = signal<boolean>(false);
	public readonly removed = signal<boolean>(false);
	public readonly error = signal<string | null>(null);

	public readonly busy = computed<boolean>(() => (this.connection()?.busy() ?? false) || this.removing());
	public readonly saved = computed<boolean>(() => this.connection()?.saved() ?? false);

	private readonly connection = viewChild(ServiceConnectionComponent);

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Remember the applied endpoint so removal never describes an older connection or a later draft. */
	public applied(applied: ServiceApplied): void {
		this.effective_configuration.set(applied.configuration);
	}

	/** Confirm removal against the saved connection, independently of an unsaved draft. */
	public confirmRemove(): void {
		if (this.busy()) return;
		this.dialog
			.open<ServiceRemoveDialogComponent, OrchardServiceConfiguration, boolean>(ServiceRemoveDialogComponent, {
				data: this.effective_configuration(),
				width: '32rem',
				maxWidth: '95vw',
			})
			.afterClosed()
			.pipe(takeUntilDestroyed(this.destroy_ref))
			.subscribe((confirmed) => {
				if (confirmed) this.remove();
			});
	}

	/** Return whether a connection was applied when closing the panel. */
	public close(): void {
		if (!this.busy()) this.panel.close(this.saved() || this.removed());
	}

	/** Remove only the selected service while preserving status-refresh errors. */
	private remove(): void {
		this.removing.set(true);
		this.error.set(null);
		this.serviceConfigService
			.remove(this.configuration.service)
			.pipe(
				takeUntilDestroyed(this.destroy_ref),
				finalize(() => this.removing.set(false)),
			)
			.subscribe({
				next: () => this.removed.set(true),
				error: (error: unknown) => this.error.set(serviceErrorMessage(error, 'Could not remove the service.')),
			});
	}
}
