/* Core Dependencies */
import {Component, ChangeDetectionStrategy, OnInit, inject, signal, DestroyRef, computed} from '@angular/core';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {finalize} from 'rxjs';

/* Application Dependencies */
import {FormPanelService} from '@client/modules/form/services/form-panel';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {ECASH_WALLET} from '@client/modules/ecash/constants/ecash.constants';

/* Native Dependencies */
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {ServiceEditorComponent} from '@client/modules/service-config/components/service-editor/service-editor.component';
import {serviceErrorMessage, serviceConfigurationDetail} from '@client/modules/service-config/helpers/service-config.helpers';
import {
	SERVICE_DESCRIPTORS,
	SERVICE_SOURCE_LABELS,
	SERVICE_STATUS_ICONS,
	SERVICE_STATUS_LABELS,
} from '@client/modules/service-config/constants/service-config.constants';

/* Shared Dependencies */
import {SettingKey, type OrchardServiceConfiguration, type ServiceKind} from '@shared/generated.types';

@Component({
	selector: 'orc-settings-services',
	imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
	templateUrl: './settings-services.component.html',
	styleUrl: './settings-services.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsServicesComponent implements OnInit {
	private readonly serviceConfigService = inject(ServiceConfigService);
	private readonly panel = inject(FormPanelService);
	private readonly crewService = inject(CrewService);
	private readonly configService = inject(ConfigService);
	private readonly destroy_ref = inject(DestroyRef);
	private readonly bitcoinService = inject(BitcoinService);
	private readonly lightningService = inject(LightningService);
	private readonly federationService = inject(FederationService);
	private readonly settingAppService = inject(SettingAppService);
	private readonly eventService = inject(EventService);

	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly ecash = ECASH_WALLET;
	public readonly sources = SERVICE_SOURCE_LABELS;
	public readonly statuses = SERVICE_STATUS_LABELS;
	public readonly status_icons = SERVICE_STATUS_ICONS;
	public readonly taproot_enabled = this.configService.config.taproot_assets.enabled;
	public readonly services = signal<OrchardServiceConfiguration[]>([]);
	public readonly loading = signal<boolean>(true);
	public readonly error = signal<string | null>(null);
	public readonly is_admin = signal<boolean>(false);
	public readonly editing = signal<ServiceKind | null>(null);
	public readonly ecash_enabled = signal<boolean>(this.settingAppService.getSetting('ecash_enabled').value);
	public readonly ecash_saving = signal<boolean>(false);
	public readonly rows = computed(() =>
		this.services().map((service) => {
			const check = this.serviceConfigService.saved_checks()[service.service];
			const chain =
				check?.chain ?? (service.service === 'bitcoin' ? this.bitcoin_info()?.chain : this.lightning_info()?.chains[0]?.network);
			const mode = check?.mode ?? (service.service === 'mint' ? this.federationService.mode() : null);
			return {...service, detail: serviceConfigurationDetail(service, chain, mode)};
		}),
	);

	private readonly bitcoin_info = toSignal(this.bitcoinService.bitcoin_blockchain_info$);
	private readonly lightning_info = toSignal(this.lightningService.lightning_info$);

	/** Configuration is shown only after the current user is known to be an administrator. */
	public ngOnInit(): void {
		this.crewService
			.isAdmin()
			.pipe(takeUntilDestroyed(this.destroy_ref))
			.subscribe({
				next: (is_admin) => {
					this.is_admin.set(is_admin);
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
		Data
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
				error: (error: unknown) => this.error.set(serviceErrorMessage(error, 'Could not load service configuration.')),
			});
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Open the shared side panel with a snapshot of the effective configuration. */
	public edit(service: OrchardServiceConfiguration): void {
		this.editing.set(service.service);
		this.panel
			.open<OrchardServiceConfiguration, boolean>(ServiceEditorComponent, {data: service})
			.afterClosed()
			.pipe(takeUntilDestroyed(this.destroy_ref))
			.subscribe(() => {
				this.editing.set(null);
				this.load();
			});
	}

	/** The ecash wallet has no connection; turning it on or off adds or removes its navigation entry. */
	public toggleEcash(): void {
		const enabled = !this.ecash_enabled();
		this.ecash_saving.set(true);
		this.settingAppService
			.updateSettings([SettingKey.EcashEnabled], [String(enabled)])
			.pipe(
				takeUntilDestroyed(this.destroy_ref),
				finalize(() => this.ecash_saving.set(false)),
			)
			.subscribe({
				next: () => {
					this.ecash_enabled.set(enabled);
					this.eventService.registerEvent(
						new EventData({type: 'SUCCESS', message: enabled ? 'Ecash wallet turned on' : 'Ecash wallet turned off'}),
					);
				},
				error: (error: unknown) => this.error.set(serviceErrorMessage(error, 'Could not update the ecash wallet.')),
			});
	}
}
