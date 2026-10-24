/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal, type WritableSignal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';

/* Vendor Dependencies */
import {
	EMPTY,
	Subscription,
	catchError,
	concat,
	distinctUntilChanged,
	exhaustMap,
	filter,
	finalize,
	map,
	switchMap,
	tap,
	timer,
	type Observable,
} from 'rxjs';
import {DateTime} from 'luxon';
import {MatButtonModule} from '@angular/material/button';
import {MatProgressBarModule} from '@angular/material/progress-bar';

/* Application Dependencies */
import {OrcErrorModule} from '@client/modules/error/error.module';
import type {OrchardError} from '@client/modules/error/types/error.types';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {MintService} from '@client/modules/mint/services/mint/mint.service';

/* Native Dependencies */
import {FederationStatusService} from '@client/modules/federation/services/federation-status.service';
import {isDevelopment} from '@client/modules/federation/helpers/federation-status.helpers';
import {toOrchardError} from '@client/modules/federation/helpers/federation-setup.helpers';
import {FEDERATION_DASHBOARD_TABS, FEDERATION_STATUS_INTERVAL_MS} from '@client/modules/federation/constants/federation.constants';
import {FederationBackupComponent} from '@client/modules/federation/components/federation-backup/federation-backup.component';
import {FederationOverviewComponent} from '@client/modules/federation/components/federation-overview/federation-overview.component';
import {FederationConsensusComponent} from '@client/modules/federation/components/federation-consensus/federation-consensus.component';
import {FederationCustodyComponent} from '@client/modules/federation/components/federation-custody/federation-custody.component';

/* Shared Dependencies */
import type {
	OrchardFederationInfo,
	OrchardFederationLocalStatus,
	OrchardFederationMemberStatuses,
	OrchardFederationCustodyStatus,
} from '@shared/generated.types';

type FederationView = (typeof FEDERATION_DASHBOARD_TABS)[number]['view'] | 'backup';

@Component({
	selector: 'orc-federation-dashboard',
	imports: [
		RouterLink,
		MatButtonModule,
		MatProgressBarModule,
		OrcErrorModule,
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
	private readonly status_service = inject(FederationStatusService);
	private readonly mint_service = inject(MintService);
	private readonly route = inject(ActivatedRoute);

	public readonly tabs = FEDERATION_DASHBOARD_TABS;
	public readonly interval_seconds = FEDERATION_STATUS_INTERVAL_MS / 1000;

	public readonly view = signal<FederationView>('overview');
	public readonly info = signal<OrchardFederationInfo | null>(null);
	public readonly local = signal<OrchardFederationLocalStatus | null>(null);
	public readonly members = signal<OrchardFederationMemberStatuses | null>(null);
	public readonly custody = signal<OrchardFederationCustodyStatus | null>(null);
	public readonly mint_info = toSignal(this.mint_service.mint_info$, {initialValue: null});
	public readonly errors = signal<Record<string, OrchardError>>({});
	public readonly updated = signal<number | null>(null);
	public readonly loading = signal(true);

	public readonly development = computed(() => isDevelopment(this.info()));
	public readonly error_items = computed(() => Object.entries(this.errors()).map(([source, error]) => ({source, error})));

	private readonly views: FederationView[] = [...FEDERATION_DASHBOARD_TABS.map((tab) => tab.view), 'backup'];

	private readonly subscriptions = new Subscription();

	/** Poll only what the selected view shows, skipping ticks while the browser tab is hidden. */
	public ngOnInit(): void {
		this.subscriptions.add(
			this.route.queryParamMap
				.pipe(
					map((params) => this.views.find((view) => view === params.get('view')) ?? 'overview'),
					distinctUntilChanged(),
					tap((view) => {
						this.view.set(view);
						this.errors.set({});
					}),
					switchMap((view) =>
						timer(0, FEDERATION_STATUS_INTERVAL_MS).pipe(
							filter(() => !document.hidden),
							exhaustMap(() => this.refresh(view)),
						),
					),
				)
				.subscribe(),
		);
	}

	/* *******************************************************
        Data
    ******************************************************** */

	/** Read one source at a time, since cdk refuses status requests past its in-flight limit; info is static, so read it until it loads. */
	private refresh(view: FederationView): Observable<unknown> {
		const reads: Observable<unknown>[] = [];
		if (!this.info()) reads.push(this.read('Federation info', this.status_service.getInfo(), this.info));
		if (view === 'overview' || view === 'consensus')
			reads.push(this.read('Local status', this.status_service.getLocalStatus(), this.local));
		if (view === 'overview' || view === 'custody')
			reads.push(this.read('Custody', this.status_service.getCustodyStatus(), this.custody));
		if (view === 'overview') reads.push(this.read('Members', this.status_service.getMemberStatuses(), this.members));
		return concat(...reads).pipe(finalize(() => this.loading.set(false)));
	}

	/** Keep the last good value after a failed read, and show the failure beside it. */
	private read<T>(source: string, request: Observable<T>, target: WritableSignal<T | null>): Observable<T> {
		return request.pipe(
			tap((value) => {
				target.set(value);
				this.updated.set(DateTime.now().toUnixInteger());
				if (source in this.errors()) this.errors.update(({[source]: _cleared, ...errors}) => errors);
			}),
			catchError((error: unknown) => {
				this.errors.update((errors) => ({...errors, [source]: toOrchardError(error)}));
				return EMPTY;
			}),
		);
	}

	/* *******************************************************
        Destroy
    ******************************************************** */

	/** Stop timers, pending status requests and route subscriptions when leaving the page. */
	public ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
