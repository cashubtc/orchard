import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {of, throwError} from 'rxjs';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {onboardingConfiguration} from '@client/modules/onboarding/helpers/onboarding.fixture';
import {OrcOnboardingModule} from '@client/modules/onboarding/onboarding.module';
import {ServiceKind, SettingKey, type OrchardServiceConfiguration} from '@shared/generated.types';
import {OnboardingComponent} from './onboarding.component';

describe('OnboardingComponent', () => {
	let configurations: OrchardServiceConfiguration[];
	let harness: RouterTestingHarness;
	let ecash_enabled: boolean;
	const mode = signal<string | null>('setup');
	const updateSettings = jasmine.createSpy().and.returnValue(of([]));
	beforeEach(async () => {
		configurations = [ServiceKind.Bitcoin, ServiceKind.Lightning, ServiceKind.Mint].map((service) => onboardingConfiguration(service));
		ecash_enabled = false;
		updateSettings.calls.reset();
		TestBed.configureTestingModule({
			imports: [MatIconTestingModule],
			providers: [
				provideRouter([{path: 'onboarding', loadChildren: () => OrcOnboardingModule}]),
				{provide: CrewService, useValue: {isAdmin: () => of(true)}},
				{provide: ConfigService, useValue: {loadStatus: () => of(undefined)}},
				{provide: ServiceConfigService, useValue: {load: () => of(configurations), refresh_errors: signal({})}},
				{provide: FederationService, useValue: {mode, loadMode: () => of({mode: mode()})}},
				{provide: SettingAppService, useValue: {getSetting: () => ({value: ecash_enabled}), updateSettings}},
			],
		});
		harness = await RouterTestingHarness.create();
	});

	/** Let a navigation the wizard started finish and render. */
	async function settle(): Promise<void> {
		await harness.fixture.whenStable();
		harness.detectChanges();
	}

	it('preselects enabled environment services, but a tile opens only its requested service', async () => {
		configurations[2] = onboardingConfiguration(ServiceKind.Mint, true, 'environment');
		const picker = await harness.navigateByUrl('/onboarding/services', OnboardingComponent);
		expect(picker.selected()).toEqual([ServiceKind.Mint]);
		const tile = await harness.navigateByUrl('/onboarding/configure/bitcoin', OnboardingComponent);
		expect(tile.selected()).toEqual([ServiceKind.Bitcoin]);
		expect(tile.stage()).toBe('configure');
	});
	it('keeps Bitcoin before Lightning, refreshes saved configuration before advancing, and reviews skips neutrally', async () => {
		const component = await harness.navigateByUrl('/onboarding/services', OnboardingComponent);
		component.toggle(ServiceKind.Mint);
		await settle();
		component.toggle(ServiceKind.Lightning);
		await settle();
		component.toggle(ServiceKind.Bitcoin);
		await settle();
		expect(component.selected()).toEqual([ServiceKind.Bitcoin, ServiceKind.Lightning, ServiceKind.Mint]);
		component.continue();
		await settle();
		expect(component.active_service()).toBe(ServiceKind.Bitcoin);
		configurations[0] = {...onboardingConfiguration(ServiceKind.Bitcoin, true, 'orchard'), status: 'connected'};
		component.applied(ServiceKind.Bitcoin, {
			ok: true,
			warning: false,
			saved: true,
			title: 'Connected',
			context: '',
			fields: [],
			chain: 'regtest',
		});
		await settle();
		expect(component.configurations()[0].enabled).toBeTrue();
		expect(component.active_service()).toBe(ServiceKind.Lightning);
		component.skipService();
		await settle();
		expect(component.active_service()).toBe(ServiceKind.Mint);
		component.skipService();
		await settle();
		expect(component.stage()).toBe('review');
		expect(component.review_rows()[1].status).toBe('Skipped');
		component.edit(ServiceKind.Lightning);
		await settle();
		expect(TestBed.inject(Router).url).toBe('/onboarding/configure/lightning?picked=bitcoin,lightning,mint&return=review');
		component.skipService();
		await settle();
		expect(component.stage()).toBe('review');
	});
	it('restores the step from the URL after browser history', async () => {
		const component = await harness.navigateByUrl('/onboarding/configure/lightning?picked=bitcoin,lightning', OnboardingComponent);
		component.back();
		await settle();
		expect(component.active_service()).toBe(ServiceKind.Bitcoin);
		await harness.navigateByUrl('/onboarding/configure/lightning?picked=bitcoin,lightning');
		expect(component.active_service()).toBe(ServiceKind.Lightning);
		expect(component.selected()).toEqual([ServiceKind.Bitcoin, ServiceKind.Lightning]);
	});
	it('opens a member on its dashboard and leaves setup routing to the mint section', async () => {
		configurations[2] = onboardingConfiguration(ServiceKind.Mint, true, 'environment');
		const component = await harness.navigateByUrl('/onboarding/review', OnboardingComponent);
		const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
		component.open();
		expect(navigate).toHaveBeenCalledWith('/mint');
		expect(component.setup_mode()).toBeTrue();
		mode.set('member');
		component.open();
		expect(navigate).toHaveBeenCalledWith('/mint/federation');
		mode.set('setup');
	});

	it('goes home when no mint is configured', async () => {
		const component = await harness.navigateByUrl('/onboarding/review', OnboardingComponent);
		const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
		component.open();
		expect(navigate).toHaveBeenCalledWith(['/']);
	});
	it('preselects an enabled ecash wallet', async () => {
		ecash_enabled = true;
		const picker = await harness.navigateByUrl('/onboarding/services', OnboardingComponent);
		expect(picker.selected()).toEqual(['ecash']);
		expect(picker.review_rows().at(-1)?.status).toBe('Enabled');
	});
	it('turns the ecash wallet on as its own step', async () => {
		const component = await harness.navigateByUrl('/onboarding/configure/ecash?picked=mint,ecash', OnboardingComponent);
		expect(component.service_states().ecash).toBe('Configuring');
		component.enableEcash();
		await settle();
		expect(updateSettings).toHaveBeenCalledWith([SettingKey.EcashEnabled], ['true']);
		expect(component.stage()).toBe('review');
		expect(component.review_rows().at(-1)).toEqual(jasmine.objectContaining({service: 'ecash', status: 'Enabled'}));
	});
	it('continues the saved step after a failed reload is retried', async () => {
		const component = await harness.navigateByUrl('/onboarding/configure/bitcoin?picked=bitcoin,lightning', OnboardingComponent);
		const load = spyOn(TestBed.inject(ServiceConfigService), 'load').and.returnValue(throwError(() => new Error('offline')));
		component.applied(ServiceKind.Bitcoin, {ok: false, saved: true, warning: false, title: 'Failed', context: '', fields: []});
		await settle();
		expect(component.active_service()).toBe(ServiceKind.Bitcoin);
		expect(component.service_states().bitcoin).toBe('Saved · test failed');
		load.and.returnValue(of(configurations));
		component.retry();
		await settle();
		expect(component.active_service()).toBe(ServiceKind.Lightning);
	});
});
