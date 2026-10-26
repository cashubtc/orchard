/* Core Dependencies */
import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	OnDestroy,
	OnInit,
	signal,
	viewChild,
} from '@angular/core';
import {Router} from '@angular/router';
import {ClipboardModule} from '@angular/cdk/clipboard';

/* Vendor Dependencies */
import {DateTime} from 'luxon';
import {
	EMPTY,
	Subject,
	Subscription,
	catchError,
	exhaustMap,
	filter,
	fromEvent,
	finalize,
	merge,
	of,
	switchMap,
	takeUntil,
	takeWhile,
	tap,
	timer,
	type Observable,
} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';

/* Application Dependencies */
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {OrcErrorModule} from '@client/modules/error/error.module';
import type {OrchardError} from '@client/modules/error/types/error.types';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcNavModule} from '@client/modules/nav/nav.module';
import {NavSetupStepsComponent} from '@client/modules/nav/components/nav-setup-steps/nav-setup-steps.component';
import type {ComponentCanDeactivate} from '@client/modules/routing/interfaces/routing.interfaces';

/* Native Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationSetupService} from '@client/modules/federation/services/federation-setup.service';
import {displayFingerprint, toOrchardError} from '@client/modules/federation/helpers/federation-setup.helpers';
import {statusLabel, timestamp} from '@client/modules/federation/helpers/federation-status.helpers';
import type {FederationSetupConfirm} from '@client/modules/federation/types/federation-setup.types';
import {FEDERATION_DKG_STAGES, FEDERATION_SETUP_STEPS} from '@client/modules/federation/constants/federation.constants';
import {FederationBackupComponent} from '@client/modules/federation/components/federation-backup/federation-backup.component';
import {FederationSetupCreateComponent} from '@client/modules/federation/components/federation-setup-create/federation-setup-create.component';
import {FederationSetupJoinComponent} from '@client/modules/federation/components/federation-setup-join/federation-setup-join.component';
import {FederationSetupReviewComponent} from '@client/modules/federation/components/federation-setup-review/federation-setup-review.component';
import {FederationSetupConfirmDialogComponent} from '@client/modules/federation/components/federation-setup-confirm-dialog/federation-setup-confirm-dialog.component';

/* Shared Dependencies */
import {
	type FederationSetupCreateInput,
	type FederationSetupJoinInput,
	type OrchardFederationSetupStatus,
	type OrchardFederationSetupInvitation,
	type OrchardFederationSetupReview,
	type OrchardFederationSetupActivated,
} from '@shared/generated.types';

type SetupView = 'start' | 'create' | 'join' | 'waiting' | 'review' | 'keygen' | 'activated' | 'aborted';

@Component({
	selector: 'orc-federation-setup',
	imports: [
		ClipboardModule,
		MatFormFieldModule,
		MatInputModule,
		NavSetupStepsComponent,
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
export class FederationSetupComponent implements ComponentCanDeactivate, OnInit, OnDestroy {
	private readonly element_ref = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly federation_service = inject(FederationService);
	private readonly setup_service = inject(FederationSetupService);
	private readonly crew_service = inject(CrewService);
	private readonly router = inject(Router);
	private readonly dialog = inject(MatDialog);

	public readonly statusLabel = statusLabel;
	public readonly displayFingerprint = displayFingerprint;
	public readonly steps = FEDERATION_SETUP_STEPS;
	public readonly stage_fields = FEDERATION_DKG_STAGES;

	public readonly mode = this.federation_service.mode;
	public readonly details = this.federation_service.details;
	public readonly is_admin = signal<boolean | null>(null);
	public readonly invitations = signal<OrchardFederationSetupInvitation[]>([]);
	public readonly status = signal<OrchardFederationSetupStatus | null>(null);
	public readonly proposal = signal<OrchardFederationSetupReview | null>(null);
	public readonly activation = signal<OrchardFederationSetupActivated | null>(null);
	public readonly choice = signal<'start' | 'create' | 'join'>('start');
	public readonly selected_member = signal<number | null>(null);
	public readonly now = signal<number>(DateTime.now().toUnixInteger());
	public readonly loading = signal<boolean>(true);
	public readonly busy = signal<boolean>(false);
	public readonly error = signal<OrchardError | null>(null);
	public readonly copy_result = signal<string | null>(null);
	public readonly backup_complete = signal<boolean>(false);

	public readonly view = computed<SetupView>(() => {
		const status = this.status();
		if (this.activation() || this.mode() === 'member' || status?.activation) return 'activated';
		if (!status?.initialized) return this.choice();
		if (
			status.participant_phase === 'SETUP_PARTICIPANT_PHASE_ABORTED' ||
			status.coordinator_phase === 'SETUP_COORDINATOR_PHASE_ABORTED'
		)
			return 'aborted';
		if (
			status.dkg ||
			[
				'SETUP_PARTICIPANT_PHASE_CERTIFIED',
				'SETUP_PARTICIPANT_PHASE_DKG_RUNNING',
				'SETUP_PARTICIPANT_PHASE_READY_TO_ACTIVATE',
			].includes(status.participant_phase ?? '')
		)
			return 'keygen';
		if (this.proposal() && this.proposal()?.proposal_hash === status.proposal_hash) return 'review';
		return 'waiting';
	});
	public readonly current_step = computed<number>(
		() => ({start: 0, create: 0, join: 0, waiting: 1, review: 2, keygen: 3, activated: 4, aborted: 1})[this.view()],
	);
	/** Hold the forms and actions while a request runs or for roles that can't change setup. */
	public readonly locked = computed<boolean>(() => this.busy() || !this.is_admin());
	public readonly is_coordinator = computed<boolean>(() => this.status()?.role === 'SETUP_ROLE_COORDINATOR');
	public readonly can_propose = computed<boolean>(
		() =>
			this.is_coordinator() &&
			(this.status()?.member_count ?? 0) > 0 &&
			this.status()?.missing_enrollments.length === 0 &&
			this.status()?.enrolled_members.length === this.status()?.member_count &&
			!this.status()?.proposal_hash,
	);
	public readonly slots = computed<number[]>(() => Array.from({length: this.status()?.member_count ?? 0}, (_, index) => index + 1));
	public readonly invitation = computed<OrchardFederationSetupInvitation | null>(
		() => this.invitations().find((item) => item.member_id === this.selected_member()) ?? null,
	);
	public readonly invitation_expires_at = computed<number | null>(() => timestamp(this.invitation()?.expires_at_unix));
	public readonly invitation_expired = computed<boolean>(() => {
		const expires = this.invitation_expires_at();
		return expires !== null && expires <= this.now();
	});
	public readonly missing_invitation_note = computed<string>(() => {
		const member_id = this.selected_member();
		if (!member_id) return 'Select a waiting member to view or replace their invitation.';
		return `This page has no invitation for member ${member_id}. Use a saved copy or replace the invitation.`;
	});
	/** Render setup views only once the daemon is known to be in setup, so an unknown mode never offers Create or Join. */
	public readonly show_setup = computed<boolean>(() => this.mode() === 'setup' || this.view() === 'activated');

	private invitation_setup_id: string | null = null;
	private polling_error = false;

	private readonly error_alert = viewChild<ElementRef<HTMLElement>>('error_alert');

	private readonly refresh_requested = new Subject<void>();
	private readonly action_started = new Subject<void>();
	private readonly subscriptions = new Subscription();

	constructor() {
		afterRenderEffect(() => {
			this.view();
			if (this.loading() || !this.show_setup()) return;
			const heading = this.element_ref.nativeElement.querySelector<HTMLElement>('h1');
			heading?.focus({preventScroll: true});
		});
		// An action's refusal renders above the fold; bring it into view, since its button may sit far below
		afterRenderEffect(() => {
			const alert = this.error_alert()?.nativeElement;
			if (alert && this.error() && !this.polling_error) alert.scrollIntoView({block: 'nearest', behavior: 'smooth'});
		});
	}

	/** Load the authenticated role before polling setup progress. */
	public ngOnInit(): void {
		this.subscriptions.add(
			this.crew_service.isAdmin().subscribe({
				next: (is_admin) => {
					this.is_admin.set(is_admin);
					this.startPolling();
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

	/** Poll until member mode; exhaustMap stops a slow daemon stacking calls, and an action cancels a poll in flight. */
	private startPolling(): void {
		this.subscriptions.add(
			merge(timer(0, 3000), this.refresh_requested, fromEvent(document, 'visibilitychange'))
				.pipe(
					takeWhile(() => this.mode() !== 'member'),
					filter(() => !document.hidden),
					tap(() => this.now.set(DateTime.now().toUnixInteger())),
					filter(() => !this.busy()),
					exhaustMap(() =>
						this.readState().pipe(
							takeUntil(this.action_started),
							catchError((error: unknown) => {
								this.showError(error, true);
								return EMPTY;
							}),
							finalize(() => this.loading.set(false)),
						),
					),
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

	/** Refresh progress and discard enrolled invitations, fetching a proposal only when its hash changes. */
	private readSetup(): Observable<unknown> {
		return this.setup_service.getStatus().pipe(
			switchMap((status) => {
				if (this.polling_error) {
					this.error.set(null);
					this.polling_error = false;
				}
				if (this.status()?.setup_id !== status.setup_id) {
					this.proposal.set(null);
					if (status.setup_id !== this.invitation_setup_id) this.selectMember(null);
				}
				this.invitations.update((invitations) =>
					status.initialized && status.setup_id === this.invitation_setup_id
						? invitations.filter((invitation) => !status.enrolled_members.includes(invitation.member_id))
						: [],
				);
				if (this.selected_member() !== null && status.enrolled_members.includes(this.selected_member()!)) {
					this.selectMember(this.invitations()[0]?.member_id ?? null);
				}
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

	/** Handle mutations once, staying busy until a status read reflects the result so the form can't be submitted twice. */
	private perform<T>(request: Observable<T>, success?: (response: T) => void): void {
		if (!this.is_admin() || !this.startAction()) return;
		this.error.set(null);
		this.subscriptions.add(
			request
				.pipe(
					tap((response) => success?.(response)),
					catchError((error: unknown) => {
						this.showError(error);
						return of(null);
					}),
					switchMap(() => this.readState().pipe(catchError(() => EMPTY))),
					finalize(() => this.busy.set(false)),
				)
				.subscribe(),
		);
	}

	/** Claim the page for one action, cancelling any poll in flight. */
	private startAction(): boolean {
		if (this.busy()) return false;
		this.busy.set(true);
		this.action_started.next();
		return true;
	}

	/** Keep creation invitations only in this page's state. */
	public create(input: FederationSetupCreateInput): void {
		this.perform(this.setup_service.create(input), (response) => {
			this.invitation_setup_id = response.setup_id;
			this.invitations.set([...response.invitations].sort((left, right) => left.member_id - right.member_id));
			this.selectMember(this.invitations()[0]?.member_id ?? null);
		});
	}

	/** Join and discard the invitation form when status confirms enrollment. */
	public join(input: FederationSetupJoinInput): void {
		this.perform(this.setup_service.join(input));
	}

	/** Propose only when every member slot is enrolled. */
	public propose(): void {
		if (this.can_propose()) this.perform(this.setup_service.propose());
	}

	/** Abort this daemon's setup; polling then shows the fresh start the daemon reports. */
	public abort(): void {
		const setup_id = this.status()?.setup_id;
		if (!setup_id) return;
		this.confirm({action: 'abort'}, () => this.perform(this.setup_service.abort(setup_id), () => this.choice.set('start')));
	}

	/** Replace an unjoined slot's invitation; the old one stops working. */
	public replaceInvitation(member_id: number): void {
		this.confirm({action: 'replace', member_id}, () =>
			this.perform(this.setup_service.replaceInvitation(member_id), ({invitation}) => {
				if (!invitation) return;
				this.invitation_setup_id = this.status()?.setup_id ?? null;
				this.invitations.update((invitations) => [...invitations.filter((item) => item.member_id !== member_id), invitation]);
				this.selectMember(member_id);
			}),
		);
	}

	/** Ask before an irreversible change, holding polling off while the dialog is open. */
	private confirm(data: FederationSetupConfirm, confirmed: () => void): void {
		if (!this.startAction()) return;
		this.subscriptions.add(
			this.dialog
				.open(FederationSetupConfirmDialogComponent, {data})
				.afterClosed()
				.subscribe((result: boolean) => {
					this.busy.set(false);
					if (result) confirmed();
				}),
		);
	}

	/** Submit the proposal hash emitted by the fingerprint review component. */
	public approve(proposal_hash: string): void {
		this.perform(this.setup_service.approve(proposal_hash));
	}

	/** Activate only after CDK reports finalized_ready. */
	public activate(): void {
		if (this.status()?.dkg?.finalized_ready)
			this.perform(this.setup_service.activate(), (response) => {
				this.activation.set(response);
				this.federation_service.rememberBackupWarning(response.federation_id, response.backup_warning);
			});
	}

	/** Reset feedback when the displayed member changes. */
	public selectMember(member_id: number | null): void {
		this.selected_member.set(member_id);
		this.copy_result.set(null);
	}

	/** Save only the invitation the operator explicitly selected. */
	public saveInvitation(): void {
		const invitation = this.invitation();
		if (!invitation || this.invitation_expired()) return;
		const url = URL.createObjectURL(new Blob([invitation.invitation], {type: 'text/plain'}));
		const link = document.createElement('a');
		link.href = url;
		link.download = `member-${invitation.member_id}.invite`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	/** Show the error, remembering whether a later successful poll may clear it. */
	private showError(error: unknown, polling_error = false): void {
		this.polling_error = polling_error;
		this.error.set(toOrchardError(error));
	}

	/* *******************************************************
        Navigation
    ******************************************************** */

	/** Unused invitations exist only on this page, so leaving or reloading asks first. */
	@HostListener('window:beforeunload')
	public canDeactivate(): boolean {
		return this.invitations().length === 0;
	}

	/** Re-match the same URL once member mode is confirmed, so it opens the member dashboard. */
	public openMint(): void {
		if (!this.backup_complete() || this.mode() !== 'member') return;
		void this.router.navigate(['/mint/federation'], {onSameUrlNavigation: 'reload'});
	}

	/* *******************************************************
        Destroy
    ******************************************************** */

	/** Cancel polling and in-flight requests. */
	public ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
