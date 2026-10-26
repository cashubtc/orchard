import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {of} from 'rxjs';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {onboardingConfiguration} from '@client/modules/onboarding/helpers/onboarding.fixture';
import {OnboardingComponent} from '@client/modules/onboarding/components/onboarding/onboarding.component';
import {ServiceKind} from '@shared/generated.types';
import {OrcOnboardingModule} from './onboarding.module';

describe('Onboarding routes', () => {
	it('opens a service directly and restores its stage when navigating through history URLs', async () => {
		TestBed.configureTestingModule({
			providers: [
				provideRouter([{path: 'onboarding', loadChildren: () => OrcOnboardingModule}]),
				{provide: CrewService, useValue: {isAdmin: () => of(true)}},
				{provide: ConfigService, useValue: {loadStatus: () => of(undefined)}},
				{provide: FederationService, useValue: {mode: signal('standalone')}},
				{provide: SettingAppService, useValue: {getSetting: () => ({value: false})}},
				{
					provide: ServiceConfigService,
					useValue: {load: () => of([onboardingConfiguration(ServiceKind.Bitcoin)]), refresh_errors: signal({})},
				},
			],
		});
		const harness = await RouterTestingHarness.create();
		const component = await harness.navigateByUrl('/onboarding/configure/bitcoin?picked=bitcoin', OnboardingComponent);
		expect(component.stage()).toBe('configure');
		expect(component.active_service()).toBe(ServiceKind.Bitcoin);
		await harness.navigateByUrl('/onboarding/review?picked=bitcoin');
		expect(component.stage()).toBe('review');
		await harness.navigateByUrl('/onboarding/configure/bitcoin?picked=bitcoin');
		expect(component.stage()).toBe('configure');
		expect(component.active_service()).toBe(ServiceKind.Bitcoin);
		const direct = await harness.navigateByUrl('/onboarding?service=bitcoin', OnboardingComponent);
		expect(direct.stage()).toBe('configure');
	});
});
