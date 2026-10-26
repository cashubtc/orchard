/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	OnInit,
	afterRenderEffect,
	computed,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {catchError, filter, finalize, forkJoin, map, of} from 'rxjs';

/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {serviceErrorMessage} from '@client/modules/service-config/helpers/service-config.helpers';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {NavSetupStepsComponent} from '@client/modules/nav/components/nav-setup-steps/nav-setup-steps.component';

/* Native Dependencies */
import {OnboardingLayoutService} from '@client/modules/onboarding/services/onboarding-layout.service';
import {
	ONBOARDING_CHOICES,
	ONBOARDING_COPY,
	ONBOARDING_DESCRIPTORS,
	ONBOARDING_STAGES,
	ONBOARDING_STEPS,
} from '@client/modules/onboarding/constants/onboarding.constants';
import {onboardingDestination, onboardingReview, onboardingRoute} from '@client/modules/onboarding/helpers/onboarding.helpers';
import type {OnboardingChoice, OnboardingOutcomes, OnboardingStage} from '@client/modules/onboarding/types/onboarding.types';
import {OnboardingPickerComponent} from '@client/modules/onboarding/components/onboarding-picker/onboarding-picker.component';
import {OnboardingConfigureComponent} from '@client/modules/onboarding/components/onboarding-configure/onboarding-configure.component';
import {OnboardingReviewComponent} from '@client/modules/onboarding/components/onboarding-review/onboarding-review.component';

/* Shared Dependencies */
import {ServiceKind, SettingKey, type OrchardConnectionCheck, type OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-onboarding',
	host: {'[class.mobile]': 'mobile()'},
	imports: [
		NavSetupStepsComponent,
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
	private readonly layout = inject(OnboardingLayoutService);
	private readonly element_ref = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly api = inject(ServiceConfigService);
	private readonly configService = inject(ConfigService);
	private readonly federationService = inject(FederationService);
	private readonly settingAppService = inject(SettingAppService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly destroy_ref = inject(DestroyRef);

	public readonly descriptors = ONBOARDING_DESCRIPTORS;
	public readonly copy = ONBOARDING_COPY;
	public readonly steps = ONBOARDING_STEPS;

	public readonly mobile = this.layout.mobile;
	public readonly configurations = signal<OrchardServiceConfiguration[]>([]);
	public readonly outcomes = signal<OnboardingOutcomes>({});
	public readonly ecash_enabled = signal<boolean>(this.settingAppService.getSetting('ecash_enabled').value);
	public readonly loading = signal<boolean>(true);
	public readonly opening = signal<boolean>(false);
	public readonly saving = signal<boolean>(false);
	public readonly error = signal<string | null>(null);

	// The URL is the only record of the step, service, picked services and return target
	public readonly stage = computed<OnboardingStage>(() => this.route_state().stage);
	public readonly active_service = computed<OnboardingChoice | null>(() => this.route_state().service);
	// Until the URL records a choice: the service a first-run tile opened, else what's already connected or enabled
	public readonly selected = computed<OnboardingChoice[]>(() => {
		const {picked, service} = this.route_state();
		if (picked) return picked;
		if (service) return [service];
		return ONBOARDING_CHOICES.filter((item) =>
			item === 'ecash'
				? this.ecash_enabled()
				: this.configurations().some((configuration) => configuration.service === item && configuration.enabled),
		);
	});
	public readonly stage_copy = computed(() => ONBOARDING_STAGES[this.stage()]);
	public readonly active_configurations = computed(() => this.configurations().filter((item) => item.service === this.active_service()));
	public readonly review_rows = computed(() => onboardingReview(this.configurations(), this.outcomes(), this.ecash_enabled()));
	public readonly service_states = computed(
		() =>
			Object.fromEntries(ONBOARDING_CHOICES.map((service) => [service, this.serviceState(service)])) as Record<
				OnboardingChoice,
				string
			>,
	);
	// A completed step shows a trailing check in the side list
	public readonly service_done = computed(
		() =>
			Object.fromEntries(
				ONBOARDING_CHOICES.map((service) => [
					service,
					service === 'ecash' ? this.ecash_enabled() : !!this.outcomes()[service]?.saved_check?.ok,
				]),
			) as Record<OnboardingChoice, boolean>,
	);
	public readonly setup_mode = computed(() => this.mint_enabled() && this.federationService.mode() === 'setup');
	public readonly busy = computed(() => this.loading() || this.opening() || this.saving() || (this.configure()?.busy() ?? false));

	private pending_advance = false;

	private readonly route_state = toSignal(
		this.router.events.pipe(
			filter((event) => event instanceof NavigationEnd),
			map(() => onboardingRoute(this.route.snapshot)),
		),
		{initialValue: onboardingRoute(this.route.snapshot)},
	);

	private readonly return_to_review = computed<boolean>(() => this.route_state().return_to_review);
	private readonly configure = viewChild(OnboardingConfigureComponent);
	private readonly mint_enabled = computed(() => this.configurations().some((item) => item.service === ServiceKind.Mint && item.enabled));

	constructor() {
		afterRenderEffect(() => {
			this.stage();
			this.active_service();
			this.element_ref.nativeElement.querySelector<HTMLElement>('h1')?.focus({preventScroll: true});
		});
	}

	/** Load effective configurations only after authentication and the administrator guard. */
	public ngOnInit(): void {
		this.load();
	}

	/* *******************************************************
		Configuration loads
	******************************************************** */

	/** Load saved values; until a step is picked, they decide the preselected services. */
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
				error: (error: unknown) => this.error.set(serviceErrorMessage(error, 'Could not load service configuration.')),
			});
	}

	/** Retry whichever load failed without discarding the session's progress. */
	public retry(): void {
		if (this.configurations().length) this.refresh();
		else this.load();
	}

	/* *******************************************************
		Service selection
	******************************************************** */

	/** Toggle optional services while retaining the required configuration order. */
	public toggle(service: OnboardingChoice): void {
		const selected = this.selected();
		const picked = ONBOARDING_CHOICES.filter((item) => (item === service ? !selected.includes(item) : selected.includes(item)));
		void this.router.navigate([], {queryParams: {picked: picked.join(',')}, queryParamsHandling: 'merge', replaceUrl: true});
	}

	/** Enter the first selected step, or review when no steps were selected. */
	public continue(): void {
		const first = this.selected()[0] ?? null;
		this.transition(first ? 'configure' : 'review', first, this.selected(), false);
	}

	/** Display one service using a new isolated form instance. */
	public showService(service: OnboardingChoice): void {
		this.transition('configure', service);
	}

	/* *******************************************************
		Applied connections
	******************************************************** */

	/** Record draft test feedback without changing which values have actually been saved. */
	public checked(service: ServiceKind, check: OrchardConnectionCheck | undefined): void {
		if (this.outcomes()[service]?.check === check) return;
		this.outcomes.update((outcomes) => ({...outcomes, [service]: {...outcomes[service], check}}));
	}

	/** The save already refreshed service flags and the mint mode; only the masked values need reloading before moving on. */
	public applied(service: ServiceKind, check: OrchardConnectionCheck): void {
		this.outcomes.update((outcomes) => ({...outcomes, [service]: {saved_check: check, check: undefined, skipped: false}}));
		this.pending_advance = true;
		this.refresh();
	}

	/** The ecash wallet has nothing to connect; turning it on adds it to the navigation. */
	public enableEcash(): void {
		if (this.busy()) return;
		this.saving.set(true);
		this.error.set(null);
		this.settingAppService
			.updateSettings([SettingKey.EcashEnabled], ['true'])
			.pipe(
				takeUntilDestroyed(this.destroy_ref),
				finalize(() => this.saving.set(false)),
			)
			.subscribe({
				next: () => {
					this.ecash_enabled.set(true);
					this.outcomes.update((outcomes) => ({...outcomes, ecash: {skipped: false}}));
					this.advance();
				},
				error: (error: unknown) => this.error.set(serviceErrorMessage(error, 'Could not turn on the ecash wallet.')),
			});
	}

	/** Skip only this step; an existing live service is never silently disconnected. */
	public skipService(): void {
		const service = this.active_service();
		if (!service || this.busy()) return;
		this.outcomes.update((outcomes) => ({...outcomes, [service]: {...outcomes[service], check: undefined, skipped: true}}));
		this.advance();
	}

	/* *******************************************************
		Navigation
	******************************************************** */

	/** Return to the preceding step without undoing a saved connection. */
	public back(): void {
		if (this.busy()) return;
		if (this.return_to_review() && this.stage() === 'configure') {
			this.transition('review');
			return;
		}
		const service = (this.stage() === 'review' ? this.selected().at(-1) : this.sibling(-1)) ?? null;
		this.transition(service ? 'configure' : 'services', service, this.selected(), false);
	}

	/** Add or edit a service from Review and return there after its step completes. */
	public edit(service: OnboardingChoice): void {
		const selected = ONBOARDING_CHOICES.filter((item) => item === service || this.selected().includes(item));
		this.transition('configure', service, selected, true);
	}

	/** Exit without changing any configured services. */
	public skip(): void {
		this.open();
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
	private refresh(): void {
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
					if (this.pending_advance) {
						this.pending_advance = false;
						this.advance();
					}
				},
				error: (error: unknown) => this.error.set(serviceErrorMessage(error, 'Could not reload service configuration.')),
			});
	}

	/** Continue the selected sequence, or return to Review after editing a summary row. */
	private advance(): void {
		const next = this.sibling(1);
		if (next && !this.return_to_review()) this.showService(next);
		else this.transition('review');
	}

	/** The selected service before or after the active one. */
	private sibling(offset: 1 | -1): OnboardingChoice | undefined {
		const selected = this.selected();
		return selected[selected.indexOf(this.active_service()!) + offset];
	}

	/** Describe the applied result before showing any unsaved test feedback. */
	private serviceState(service: OnboardingChoice): string {
		const outcome = this.outcomes()[service];
		if (service === 'ecash' && this.ecash_enabled()) return 'Enabled';
		if (outcome?.saved_check) {
			if (!outcome.saved_check.ok) return 'Saved · test failed';
			if (outcome.saved_check.warning && outcome.saved_check.fields.includes('database')) return 'Connected · database missing';
			return `Connected${outcome.saved_check.chain ? ' · ' + outcome.saved_check.chain : ''}`;
		}
		if (outcome?.check && !outcome.check.ok) return 'Test failed';
		if (service === this.active_service()) return 'Configuring';
		return outcome?.skipped ? 'Skipped' : 'Next';
	}

	/* *******************************************************
		Route state
	******************************************************** */

	/** Navigate to a step; the view follows the URL, which keeps only non-secret navigation choices. */
	private transition(
		stage: OnboardingStage,
		service: OnboardingChoice | null = null,
		selected: OnboardingChoice[] = this.selected(),
		return_to_review: boolean = this.return_to_review(),
	): void {
		this.pending_advance = false;
		void this.router.navigate(['/onboarding', stage, ...(service ? [service] : [])], {
			queryParams: {picked: selected.join(','), return: return_to_review ? 'review' : null},
		});
	}
}
