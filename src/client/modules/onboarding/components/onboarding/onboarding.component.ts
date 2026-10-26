/* Core Dependencies */
import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {catchError, finalize, forkJoin, of} from 'rxjs';

/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';

/* Native Dependencies */
import {ONBOARDING_SERVICES, ONBOARDING_STAGES, ONBOARDING_STEPS} from '@client/modules/onboarding/constants/onboarding.constants';
import {onboardingDestination, onboardingReview, onboardingService} from '@client/modules/onboarding/helpers/onboarding.helpers';
import type {OnboardingOutcomes, OnboardingStage} from '@client/modules/onboarding/types/onboarding.types';
import {OnboardingPickerComponent} from '@client/modules/onboarding/components/onboarding-picker/onboarding-picker.component';
import {OnboardingConfigureComponent} from '@client/modules/onboarding/components/onboarding-configure/onboarding-configure.component';
import {OnboardingReviewComponent} from '@client/modules/onboarding/components/onboarding-review/onboarding-review.component';

/* Shared Dependencies */
import {ServiceKind, type OrchardConnectionCheck, type OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-onboarding',
	imports: [
		MatButtonModule,
		MatIconModule,
		MatProgressBarModule,
		OrcGraphicModule,
		OnboardingPickerComponent,
		OnboardingConfigureComponent,
		OnboardingReviewComponent,
	],
	templateUrl: './onboarding.component.html',
	styleUrl: './onboarding.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingComponent implements OnInit {
	private readonly api = inject(ServiceConfigService);
	private readonly configService = inject(ConfigService);
	private readonly federationService = inject(FederationService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly destroy_ref = inject(DestroyRef);

	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly steps = ONBOARDING_STEPS;
	public readonly stage = signal<OnboardingStage>('services');
	public readonly selected = signal<ServiceKind[]>([]);
	public readonly active_service = signal<ServiceKind | null>(null);
	public readonly configurations = signal<OrchardServiceConfiguration[]>([]);
	public readonly outcomes = signal<OnboardingOutcomes>({});
	public readonly loading = signal(true);
	public readonly opening = signal(false);
	public readonly error = signal<string | null>(null);

	public readonly stage_copy = computed(() => ONBOARDING_STAGES[this.stage()]);
	public readonly active_configurations = computed(() => this.configurations().filter((item) => item.service === this.active_service()));
	public readonly review_rows = computed(() => onboardingReview(this.configurations(), this.outcomes()));
	public readonly service_states = computed(
		() =>
			Object.fromEntries(ONBOARDING_SERVICES.map((service) => [service, this.serviceState(service)])) as Record<ServiceKind, string>,
	);
	public readonly setup_mode = computed(() => this.mint_enabled() && this.federationService.mode() === 'setup');
	public readonly busy = computed(() => this.loading() || this.opening() || (this.configure()?.busy() ?? false));

	private return_to_review = false;
	private readonly configure = viewChild(OnboardingConfigureComponent);
	private readonly mint_enabled = computed(() => this.configurations().some((item) => item.service === ServiceKind.Mint && item.enabled));

	/** Load effective configurations only after authentication and the administrator guard. */
	public ngOnInit(): void {
		this.load();
	}

	/* *******************************************************
        Configuration and progress
    ******************************************************** */

	/** Load saved values and preselect what's connected, or only the service a first-run tile asked for. */
	public load(): void {
		this.loading.set(true);
		this.error.set(null);
		forkJoin({configurations: this.api.load(), status: this.configService.loadStatus()})
			.pipe(
				takeUntilDestroyed(this.destroy_ref),
				finalize(() => this.loading.set(false)),
			)
			.subscribe({
				next: ({configurations}) => {
					this.configurations.set(configurations);
					const direct = onboardingService(this.route.snapshot.queryParamMap.get('service'));
					this.selected.set(
						direct
							? [direct]
							: ONBOARDING_SERVICES.filter((service) =>
									configurations.some((item) => item.service === service && item.enabled),
								),
					);
					if (direct) this.showService(direct);
					// Only Review needs the mode, so the probe never holds up the form
					if (this.mint_enabled())
						this.federationService
							.loadMode()
							.pipe(
								catchError(() => of(null)),
								takeUntilDestroyed(this.destroy_ref),
							)
							.subscribe();
				},
				error: () => this.error.set('Could not load service configuration. Try again to continue.'),
			});
	}

	/** Retry whichever load failed without discarding the session's progress. */
	public retry(): void {
		if (this.configurations().length) this.refresh();
		else this.load();
	}

	/** Toggle optional services while retaining the required configuration order. */
	public toggle(service: ServiceKind): void {
		this.selected.update((selected) =>
			ONBOARDING_SERVICES.filter((item) => (item === service ? !selected.includes(item) : selected.includes(item))),
		);
	}

	/** Enter the first selected step, or review when no steps were selected. */
	public continue(): void {
		this.return_to_review = false;
		const first = this.selected()[0];
		if (first) this.showService(first);
		else this.stage.set('review');
	}

	/** Display one service using a new isolated form instance. */
	public showService(service: ServiceKind): void {
		this.active_service.set(service);
		this.stage.set('configure');
	}

	/** Record draft test feedback without changing which values have actually been saved. */
	public checked(service: ServiceKind, check: OrchardConnectionCheck | undefined): void {
		if (this.outcomes()[service]?.check === check) return;
		this.outcomes.update((outcomes) => ({...outcomes, [service]: {...outcomes[service], check}}));
	}

	/** The save already refreshed service flags and the mint mode; only the masked values need reloading before moving on. */
	public applied(service: ServiceKind, check: OrchardConnectionCheck): void {
		this.outcomes.update((outcomes) => ({...outcomes, [service]: {...outcomes[service], saved_check: check}}));
		this.refresh(() => this.advance());
	}

	/** Skip only this step; an existing live service is never silently disconnected. */
	public skipService(): void {
		const service = this.active_service();
		if (!service || this.busy()) return;
		this.outcomes.update((outcomes) => ({...outcomes, [service]: {...outcomes[service], check: undefined, skipped: true}}));
		this.advance();
	}

	/** Return to the preceding step without undoing a saved connection. */
	public back(): void {
		if (this.busy()) return;
		if (this.return_to_review && this.stage() === 'configure') {
			this.stage.set('review');
			return;
		}
		const service = this.stage() === 'review' ? this.selected().at(-1) : this.sibling(-1);
		this.return_to_review = false;
		if (service) this.showService(service);
		else this.stage.set('services');
	}

	/** Add or edit a service from Review and return there after its step completes. */
	public edit(service: ServiceKind): void {
		this.return_to_review = true;
		this.selected.update((selected) => ONBOARDING_SERVICES.filter((item) => item === service || selected.includes(item)));
		this.showService(service);
	}

	/** Exit without changing any configured services. */
	public skip(): void {
		void this.router.navigate(['/']);
	}

	/** Review has no save action; open the section the configured mint belongs in. */
	public open(): void {
		if (this.busy()) return;
		if (!this.mint_enabled()) {
			void this.router.navigate(['/']);
			return;
		}
		this.opening.set(true);
		this.federationService
			.loadMode()
			.pipe(
				catchError(() => of(null)),
				takeUntilDestroyed(this.destroy_ref),
				finalize(() => this.opening.set(false)),
			)
			.subscribe((result) => void this.router.navigateByUrl(onboardingDestination(result?.mode ?? null)));
	}

	/** Reload saved values so masked secrets and statuses match what was applied. */
	private refresh(next?: () => void): void {
		this.loading.set(true);
		this.error.set(null);
		this.api
			.load()
			.pipe(
				takeUntilDestroyed(this.destroy_ref),
				finalize(() => this.loading.set(false)),
			)
			.subscribe({
				next: (configurations) => {
					this.configurations.set(configurations);
					next?.();
				},
				error: () => this.error.set('Could not reload service configuration. Try again to continue.'),
			});
	}

	/** Continue the selected sequence, or return to Review after editing a summary row. */
	private advance(): void {
		const next = this.sibling(1);
		if (next && !this.return_to_review) this.showService(next);
		else this.stage.set('review');
	}

	/** The selected service before or after the active one. */
	private sibling(offset: 1 | -1): ServiceKind | undefined {
		const selected = this.selected();
		return selected[selected.indexOf(this.active_service()!) + offset];
	}

	/** Describe each side-list entry using this session's actual test feedback. */
	private serviceState(service: ServiceKind): string {
		const outcome = this.outcomes()[service];
		if (outcome?.check && !outcome.check.ok) return 'Test failed';
		if (service === this.active_service()) return 'Configuring';
		if (outcome?.saved_check)
			return outcome.saved_check.ok
				? `Connected${outcome.saved_check.chain ? ' · ' + outcome.saved_check.chain : ''}`
				: 'Saved · test failed';
		return outcome?.skipped ? 'Skipped' : 'Next';
	}
}
