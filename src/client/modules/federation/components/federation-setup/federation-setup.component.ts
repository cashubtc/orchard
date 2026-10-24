/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {Router} from '@angular/router';
import {ClipboardModule} from '@angular/cdk/clipboard';

/* Vendor Dependencies */
import {
	EMPTY,
	Subject,
	Subscription,
	catchError,
	exhaustMap,
	filter,
	finalize,
	merge,
	of,
	switchMap,
	takeWhile,
	tap,
	timer,
	type Observable,
} from 'rxjs';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

/* Application Dependencies */
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {OrcErrorModule} from '@client/modules/error/error.module';
import type {OrchardError} from '@client/modules/error/types/error.types';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcNavModule} from '@client/modules/nav/nav.module';

/* Native Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationSetupService} from '@client/modules/federation/services/federation-setup.service';
import {phaseLabel, toOrchardError} from '@client/modules/federation/helpers/federation-setup.helpers';
import {FEDERATION_DKG_STAGES, FEDERATION_SETUP_STEPS} from '@client/modules/federation/constants/federation.constants';
import {FederationBackupComponent} from '@client/modules/federation/components/federation-backup/federation-backup.component';
import {FederationSetupCreateComponent} from '@client/modules/federation/components/federation-setup-create/federation-setup-create.component';
import {FederationSetupJoinComponent} from '@client/modules/federation/components/federation-setup-join/federation-setup-join.component';
import {FederationSetupReviewComponent} from '@client/modules/federation/components/federation-setup-review/federation-setup-review.component';

/* Shared Dependencies */
import {
	UserRole,
	type FederationSetupCreateInput,
	type FederationSetupJoinInput,
	type OrchardFederationSetupStatus,
	type OrchardFederationSetupReview,
	type OrchardFederationSetupActivated,
} from '@shared/generated.types';

type SetupView = 'start' | 'create' | 'join' | 'waiting' | 'review' | 'keygen' | 'activated' | 'aborted';

@Component({
	selector: 'orc-federation-setup',
	imports: [
		ClipboardModule,
		MatButtonModule,
		MatIconModule,
		MatProgressBarModule,
		OrcErrorModule,
		OrcGraphicModule,
		OrcLocalModule,
		OrcNavModule,
		FederationBackupComponent,
		FederationSetupCreateComponent,
		FederationSetupJoinComponent,
		FederationSetupReviewComponent,
	],
	templateUrl: './federation-setup.component.html',
	styleUrl: './federation-setup.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupComponent implements OnInit, OnDestroy {
	private readonly federation_service = inject(FederationService);
	private readonly setup_service = inject(FederationSetupService);
	private readonly crew_service = inject(CrewService);
	private readonly router = inject(Router);

	public readonly phaseLabel = phaseLabel;
	public readonly steps = FEDERATION_SETUP_STEPS;
	public readonly stage_fields = FEDERATION_DKG_STAGES;

	public readonly mode = this.federation_service.mode;
	public readonly details = this.federation_service.details;
	public readonly is_admin = signal<boolean | null>(null);
	public readonly status = signal<OrchardFederationSetupStatus | null>(null);
	public readonly proposal = signal<OrchardFederationSetupReview | null>(null);
	public readonly activation = signal<OrchardFederationSetupActivated | null>(null);
	public readonly choice = signal<'start' | 'create' | 'join'>('start');
	public readonly selected_member = signal<number | null>(null);
	public readonly loading = signal(true);
	public readonly busy = signal(false);
	public readonly polling = signal(false);
	public readonly error = signal<OrchardError | null>(null);
	public readonly copy_result = signal<string | null>(null);
	public readonly backup_complete = signal(false);

	public readonly view = computed<SetupView>(() => {
		const status = this.status();
		if (this.activation() || this.mode() === 'member' || status?.activation) return 'activated';
		if (!status?.initialized) return this.choice();
		if (status.participant_phase === 'aborted' || status.coordinator_phase === 'aborted') return 'aborted';
		if (status.dkg || ['certified', 'dkg_running', 'ready_to_activate'].includes(status.participant_phase)) return 'keygen';
		if (this.proposal() && this.proposal()?.proposal_hash === status.proposal_hash) return 'review';
		return 'waiting';
	});
	public readonly current_step = computed(
		() => ({start: 0, create: 0, join: 0, waiting: 1, review: 2, keygen: 3, activated: 4, aborted: 1})[this.view()],
	);
	public readonly can_propose = computed(
		() =>
			this.status()?.role === 'coordinator' &&
			(this.status()?.member_count ?? 0) > 0 &&
			this.status()?.missing_enrollments.length === 0 &&
			this.status()?.enrolled_members.length === this.status()?.member_count &&
			!this.status()?.proposal_hash,
	);
	public readonly slots = computed(() => Array.from({length: this.status()?.member_count ?? 0}, (_, index) => index + 1));
	public readonly invitation = computed(() =>
		this.selected_member() === null
			? (this.status()?.invitations[0] ?? null)
			: (this.status()?.invitations.find((item) => item.member_id === this.selected_member()) ?? null),
	);
	public readonly action_disabled = computed(() => this.busy() || this.polling());

	private polling_error = false;
	private readonly refresh_requested = new Subject<void>();
	private readonly subscriptions = new Subscription();

	/** Wait for the authenticated user's role before polling admin-only setup data. */
	public ngOnInit(): void {
		this.subscriptions.add(
			this.crew_service.loadUser().subscribe({
				next: (user) => {
					this.is_admin.set(user.role === UserRole.Admin);
					if (this.is_admin()) this.startPolling();
					else this.loading.set(false);
				},
				error: (error: unknown) => {
					this.showError(error);
					this.loading.set(false);
				},
			}),
		);
	}

	/* *******************************************************
        Polling
    ******************************************************** */

	/** Poll until the daemon reports member mode; exhaustMap keeps a slow daemon from stacking status calls. */
	private startPolling(): void {
		this.subscriptions.add(
			merge(timer(0, 3000), this.refresh_requested)
				.pipe(
					takeWhile(() => this.mode() !== 'member'),
					filter(() => !this.busy()),
					exhaustMap(() => {
						this.polling.set(true);
						return this.readState().pipe(
							catchError((error: unknown) => {
								this.showError(error, true);
								return EMPTY;
							}),
							finalize(() => {
								this.polling.set(false);
								this.loading.set(false);
							}),
						);
					}),
					finalize(() => this.loading.set(false)),
				)
				.subscribe(),
		);
	}

	/** Reconcile setup or activation with the daemon's current mode. */
	private readState(): Observable<unknown> {
		if (this.mode() !== 'setup' || this.activation()) {
			return this.federation_service.loadMode(true).pipe(
				switchMap(({mode}) => {
					if (mode === 'standalone') {
						void this.router.navigate(['/mint']);
						return of(null);
					}
					if (mode === 'setup' && !this.activation()) return this.readSetup();
					if (mode === 'member') this.error.set(null);
					return of(null);
				}),
			);
		}
		return this.readSetup().pipe(
			catchError((error: unknown) =>
				this.federation_service.loadMode(true).pipe(
					tap(({mode}) => {
						if (mode !== 'member') this.showError(error, true);
						else this.error.set(null);
					}),
				),
			),
		);
	}

	/** Refresh invitations and progress, fetching a proposal only when its hash changes. */
	private readSetup(): Observable<unknown> {
		return this.setup_service.getStatus().pipe(
			switchMap((status) => {
				if (this.polling_error) {
					this.error.set(null);
					this.polling_error = false;
				}
				if (this.status()?.setup_id !== status.setup_id) this.proposal.set(null);
				this.status.set(status);
				if (!status.proposal_hash || status.proposal_hash === this.proposal()?.proposal_hash || status.dkg) return of(status);
				return this.setup_service.review().pipe(
					tap((proposal) => this.proposal.set(proposal)),
					catchError((error: unknown) => {
						this.showError(error, true);
						return EMPTY;
					}),
				);
			}),
		);
	}

	/** Request an immediate status check without starting another polling loop. */
	public refresh(): void {
		this.refresh_requested.next();
	}

	/* *******************************************************
        Actions
    ******************************************************** */

	/** Handle mutations once; an uncertain response is reconciled by subsequent status polling. */
	private perform<T>(request: Observable<T>, success?: (response: T) => void): void {
		if (this.action_disabled()) return;
		this.busy.set(true);
		this.error.set(null);
		this.subscriptions.add(
			request
				.pipe(
					finalize(() => {
						this.busy.set(false);
						this.refresh_requested.next();
					}),
				)
				.subscribe({
					next: (response) => success?.(response),
					error: (error: unknown) => this.showError(error),
				}),
		);
	}

	/** Create and immediately show the coordinator's invitations, without storing them in the browser. */
	public create(input: FederationSetupCreateInput): void {
		this.perform(this.setup_service.create(input));
	}

	/** Join and discard the invitation form when status confirms enrollment. */
	public join(input: FederationSetupJoinInput): void {
		this.perform(this.setup_service.join(input));
	}

	/** Propose only when every member slot is enrolled. */
	public propose(): void {
		if (this.can_propose()) this.perform(this.setup_service.propose());
	}

	/** Submit the proposal hash emitted by the fingerprint review component. */
	public approve(proposal_hash: string): void {
		this.perform(this.setup_service.approve(proposal_hash));
	}

	/** Activate only after CDK reports finalized_ready. */
	public activate(): void {
		if (this.status()?.dkg?.finalized_ready) this.perform(this.setup_service.activate(), (response) => this.activation.set(response));
	}

	/** Save only the invitation the operator explicitly selected. */
	public saveInvitation(): void {
		const invitation = this.invitation();
		if (!invitation) return;
		const url = URL.createObjectURL(new Blob([invitation.invitation], {type: 'text/plain'}));
		const link = document.createElement('a');
		link.href = url;
		link.download = `member-${invitation.member_id}.invite`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	/** Re-match the same URL once member mode is confirmed, so it opens the member dashboard. */
	public openMint(): void {
		if (!this.backup_complete() || this.mode() !== 'member') return;
		void this.router.navigate(['/mint/federation'], {onSameUrlNavigation: 'reload'});
	}

	/** Show the error, remembering whether a later successful poll may clear it. */
	private showError(error: unknown, polling_error = false): void {
		this.polling_error = polling_error;
		this.error.set(toOrchardError(error));
	}

	/* *******************************************************
        Destroy
    ******************************************************** */

	/** Cancel polling and in-flight requests. */
	public ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
