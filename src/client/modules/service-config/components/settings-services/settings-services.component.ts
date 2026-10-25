/* Core Dependencies */
import {Component, ChangeDetectionStrategy, OnInit, inject, signal, DestroyRef, TemplateRef, viewChild} from '@angular/core';
import {UpperCasePipe} from '@angular/common';
import {RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {finalize} from 'rxjs';

/* Application Dependencies */
import {FormPanelService} from '@client/modules/form/services/form-panel';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {ConfigService} from '@client/modules/config/services/config.service';

/* Native Dependencies */
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {ServiceEditorComponent} from '@client/modules/service-config/components/service-editor/service-editor.component';
import {
	SERVICE_DESCRIPTORS,
	SERVICE_SOURCE_LABELS,
	SERVICE_STATUS_LABELS,
} from '@client/modules/service-config/constants/service-config.constants';

/* Shared Dependencies */
import {UserRole, type OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-settings-services',
	imports: [UpperCasePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, MatDialogModule],
	templateUrl: './settings-services.component.html',
	styleUrl: './settings-services.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsServicesComponent implements OnInit {
	private readonly serviceConfigService = inject(ServiceConfigService);
	private readonly panel = inject(FormPanelService);
	private readonly dialog = inject(MatDialog);
	private readonly crewService = inject(CrewService);
	private readonly configService = inject(ConfigService);
	private readonly destroy_ref = inject(DestroyRef);

	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly sources = SERVICE_SOURCE_LABELS;
	public readonly statuses = SERVICE_STATUS_LABELS;
	public readonly taproot_enabled = this.configService.config.taproot_assets.enabled;
	public readonly services = signal<OrchardServiceConfiguration[]>([]);
	public readonly loading = signal(true);
	public readonly error = signal<string | null>(null);
	public readonly is_admin = signal(false);
	public readonly removing = signal<OrchardServiceConfiguration | null>(null);
	public readonly confirmation = signal<string | null>(null);

	private readonly remove_dialog = viewChild.required<TemplateRef<unknown>>('removeDialog');

	/** Configuration is shown only after the current user is known to be an administrator. */
	public ngOnInit(): void {
		this.crewService
			.loadUser()
			.pipe(takeUntilDestroyed(this.destroy_ref))
			.subscribe({
				next: (user) => {
					this.is_admin.set(user.role === UserRole.Admin);
					if (this.is_admin()) this.load();
					else this.loading.set(false);
				},
				error: () => {
					this.loading.set(false);
					this.error.set('Could not load your access level.');
				},
			});
	}

	/* *******************************************************
        Data and actions
    ******************************************************** */

	/** Refresh sources and statuses after closing an editor or removing a connection. */
	public load(): void {
		this.loading.set(true);
		this.error.set(null);
		this.serviceConfigService
			.load()
			.pipe(
				takeUntilDestroyed(this.destroy_ref),
				finalize(() => this.loading.set(false)),
			)
			.subscribe({
				next: (services) => this.services.set(services),
				error: () => this.error.set('Could not load service configuration.'),
			});
	}

	/** Open the shared side panel with a snapshot of the effective configuration. */
	public edit(service: OrchardServiceConfiguration): void {
		this.panel
			.open<OrchardServiceConfiguration, boolean>(ServiceEditorComponent, {data: service})
			.afterClosed()
			.pipe(takeUntilDestroyed(this.destroy_ref))
			.subscribe(() => this.load());
	}

	/** Explain and confirm disconnection before writing the disabled override. */
	public confirmRemove(service: OrchardServiceConfiguration): void {
		this.removing.set(service);
		this.dialog
			.open(this.remove_dialog(), {width: '32rem', maxWidth: '95vw'})
			.afterClosed()
			.pipe(takeUntilDestroyed(this.destroy_ref))
			.subscribe((confirmed: boolean) => {
				if (!confirmed) return;
				this.loading.set(true);
				this.serviceConfigService
					.remove(service.service)
					.pipe(
						takeUntilDestroyed(this.destroy_ref),
						finalize(() => this.loading.set(false)),
					)
					.subscribe({
						next: () => {
							this.confirmation.set(`${this.descriptors[service.service].name} removed. No restart needed.`);
							this.load();
						},
						error: () => this.error.set('Could not remove the service.'),
					});
			});
	}
}
