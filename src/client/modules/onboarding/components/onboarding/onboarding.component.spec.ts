import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {provideRouter, ActivatedRoute, Router} from '@angular/router';
import {of} from 'rxjs';
import {ConfigService} from '@client/modules/config/services/config.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {onboardingConfiguration} from '@client/modules/onboarding/helpers/onboarding.fixture';
import {ServiceKind, type OrchardServiceConfiguration} from '@shared/generated.types';
import {OnboardingComponent} from './onboarding.component';

describe('OnboardingComponent', () => {
	let configurations: OrchardServiceConfiguration[];
	let direct: string | null;
	const mode = signal<string | null>('setup');
	beforeEach(() => {
		configurations = [ServiceKind.Bitcoin, ServiceKind.Lightning, ServiceKind.Mint].map((service) => onboardingConfiguration(service));
		direct = null;
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: {get: () => direct}}}},
				{provide: ConfigService, useValue: {loadStatus: () => of([])}},
				{provide: ServiceConfigService, useValue: {load: () => of(configurations)}},
				{provide: FederationService, useValue: {mode, loadMode: () => of({mode: mode()})}},
			],
		});
	});
	it('preselects enabled environment services, but a tile opens only its requested service', () => {
		configurations[2] = onboardingConfiguration(ServiceKind.Mint, true, 'environment');
		const picker = TestBed.createComponent(OnboardingComponent);
		picker.detectChanges();
		expect(picker.componentInstance.selected()).toEqual([ServiceKind.Mint]);
		picker.destroy();
		direct = 'bitcoin';
		const tile = TestBed.createComponent(OnboardingComponent);
		tile.detectChanges();
		expect(tile.componentInstance.selected()).toEqual([ServiceKind.Bitcoin]);
		expect(tile.componentInstance.stage()).toBe('configure');
	});
	it('keeps Bitcoin before Lightning, refreshes saved configuration before advancing, and reviews skips neutrally', () => {
		const fixture = TestBed.createComponent(OnboardingComponent);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		component.toggle(ServiceKind.Mint);
		component.toggle(ServiceKind.Lightning);
		component.toggle(ServiceKind.Bitcoin);
		component.continue();
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
		expect(component.configurations()[0].enabled).toBeTrue();
		expect(component.active_service()).toBe(ServiceKind.Lightning);
		component.skipService();
		expect(component.active_service()).toBe(ServiceKind.Mint);
		component.skipService();
		expect(component.stage()).toBe('review');
		expect(component.review_rows()[1].status).toBe('Skipped');
		component.edit(ServiceKind.Lightning);
		component.skipService();
		expect(component.stage()).toBe('review');
	});
	it('opens a member on its dashboard and leaves setup routing to the mint section', () => {
		configurations[2] = onboardingConfiguration(ServiceKind.Mint, true, 'environment');
		const fixture = TestBed.createComponent(OnboardingComponent);
		fixture.detectChanges();
		const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
		fixture.componentInstance.open();
		expect(navigate).toHaveBeenCalledWith('/mint');
		expect(fixture.componentInstance.setup_mode()).toBeTrue();
		mode.set('member');
		fixture.componentInstance.open();
		expect(navigate).toHaveBeenCalledWith('/mint/federation');
		mode.set('setup');
	});

	it('goes home when no mint is configured', () => {
		const fixture = TestBed.createComponent(OnboardingComponent);
		fixture.detectChanges();
		const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
		fixture.componentInstance.open();
		expect(navigate).toHaveBeenCalledWith(['/']);
	});
});
