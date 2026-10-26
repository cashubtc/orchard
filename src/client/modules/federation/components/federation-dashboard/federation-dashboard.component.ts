/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';

/* Vendor Dependencies */
import {
	EMPTY,
	Subscription,
	concat,
	distinctUntilChanged,
	exhaustMap,
	finalize,
	fromEvent,
	map,
	startWith,
	switchMap,
	tap,
	timer,
	type Observable,
} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatProgressBarModule} from '@angular/material/progress-bar';

/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {MintService} from '@client/modules/mint/services/mint/mint.service';

/* Native Dependencies */
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationStatusService} from '@client/modules/federation/services/federation-status.service';
import {FederationStatusErrorComponent} from '@client/modules/federation/components/federation-status-error/federation-status-error.component';
import {FederationBackupComponent} from '@client/modules/federation/components/federation-backup/federation-backup.component';
import {FederationOverviewComponent} from '@client/modules/federation/components/federation-overview/federation-overview.component';
import {FederationConsensusComponent} from '@client/modules/federation/components/federation-consensus/federation-consensus.component';
import {FederationCustodyComponent} from '@client/modules/federation/components/federation-custody/federation-custody.component';
import {
	FEDERATION_DASHBOARD_TABS,
	FEDERATION_MEMBERS_MIN_INTERVAL_MS,
	FEDERATION_STATUS_INTERVAL_MS,
} from '@client/modules/federation/constants/federation.constants';

type FederationView = (typeof FEDERATION_DASHBOARD_TABS)[number]['view'] | 'backup';

@Component({
	selector: 'orc-federation-dashboard',
	imports: [
		RouterLink,
		MatButtonModule,
		MatProgressBarModule,
		FederationStatusErrorComponent,
		OrcLocalModule,
		FederationBackupComponent,
		FederationOverviewComponent,
		FederationConsensusComponent,
		FederationCustodyComponent,
	],
	templateUrl: './federation-dashboard.component.html',
	styleUrl: './federation-dashboard.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationDashboardComponent implements OnInit, OnDestroy {
	private readonly settings_service = inject(FederationSettingsService);
	private readonly status_service = inject(FederationStatusService);
	private readonly mint_service = inject(MintService);
	private readonly config_service = inject(ConfigService);
	private readonly federation_service = inject(FederationService);
	private readonly route = inject(ActivatedRoute);

	public readonly tabs = FEDERATION_DASHBOARD_TABS;
	public readonly interval_seconds = FEDERATION_STATUS_INTERVAL_MS / 1000;

	public readonly view = signal<FederationView>('overview');
	public readonly loading = signal<boolean>(true);
	public readonly info = this.status_service.info.asReadonly();
	public readonly local = this.status_service.local.asReadonly();
	public readonly members = this.status_service.members.asReadonly();
	public readonly custody = this.status_service.custody.asReadonly();
	public readonly info_error = this.status_service.info_error.asReadonly();
	public readonly local_error = this.status_service.local_error.asReadonly();
	public readonly members_error = this.status_service.members_error.asReadonly();
	public readonly custody_error = this.status_service.custody_error.asReadonly();
	public readonly updated = this.status_service.updated.asReadonly();
	public readonly mint_info = toSignal(this.mint_service.mint_info$, {initialValue: null});

	public readonly public_api = computed(() => this.config_service.config.mint.public_api);
	public readonly development = this.status_service.development;
	public readonly local_loading = computed(() => !this.local() && !this.local_error());
	public readonly custody_loading = computed(() => !this.custody() && !this.custody_error());
	public readonly backup_warning = computed(() =>
		this.info()?.federation_id === this.federation_service.backup_federation_id() ? this.federation_service.backup_warning() : null,
	);

	private readonly views: FederationView[] = [...FEDERATION_DASHBOARD_TABS.map((tab) => tab.view), 'backup'];
	private last_members_read = -Infinity;
	private settings_requested = false;

	private readonly subscriptions = new Subscription();

	/** Poll only what the selected view shows; a view change cancels reads still in flight. */
	public ngOnInit(): void {
		this.subscriptions.add(
			this.route.queryParamMap
				.pipe(
					map((params) => this.views.find((view) => view === params.get('view')) ?? 'overview'),
					distinctUntilChanged(),
					tap((view) => this.view.set(view)),
					switchMap((view) => this.getTicks().pipe(exhaustMap(() => this.refresh(view)))),
				)
				.subscribe(),
		);
	}

	/* *******************************************************
        Data
    ******************************************************** */

	/** Tick on the poll interval only while the browser tab is visible; becoming visible reads at once. */
	private getTicks(): Observable<number> {
		return fromEvent(document, 'visibilitychange').pipe(
			startWith(null),
			map(() => document.hidden),
			distinctUntilChanged(),
			switchMap((hidden) => (hidden ? EMPTY : timer(0, FEDERATION_STATUS_INTERVAL_MS))),
		);
	}

	/** Read the selected view's sources in turn; info is static, so read it until it loads. Members go first so their reads keep the tick's pace. */
	private refresh(view: FederationView): Observable<unknown> {
		const members_due = view === 'overview' && Date.now() - this.last_members_read >= FEDERATION_MEMBERS_MIN_INTERVAL_MS;
		if (members_due) this.last_members_read = Date.now();
		const reads: Observable<unknown>[] = [];
		if (!this.info()) reads.push(this.status_service.loadInfo());
		if (members_due) reads.push(this.status_service.loadMemberStatuses());
		if (view === 'overview' || view === 'custody' || this.custody_loading()) reads.push(this.status_service.loadCustodyStatus());
		if (view === 'overview' || view === 'consensus') reads.push(this.status_service.loadLocalStatus());
		return concat(...reads).pipe(
			tap({complete: () => this.loadSettings(view)}),
			finalize(() => this.loading.set(false)),
		);
	}

	/** Compare member settings once, after the Overview's own reads, so it never competes with them. */
	private loadSettings(view: FederationView): void {
		if (view !== 'overview' || this.settings_requested) return;
		this.settings_requested = true;
		this.settings_service.load();
	}

	/* *******************************************************
        Destroy
    ******************************************************** */

	/** Stop timers, pending status requests and route subscriptions when leaving the page. */
	public ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
