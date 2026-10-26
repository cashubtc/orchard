import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {onboardingConfiguration} from '@client/modules/onboarding/helpers/onboarding.fixture';
import {ServiceKind} from '@shared/generated.types';
import {OnboardingConfigureComponent} from './onboarding-configure.component';

describe('OnboardingConfigureComponent', () => {
	it('tests without advancing, blocks failed saves, and advances after an explicit bypass', () => {
		const failure = {ok: false, warning: false, title: 'Failed', context: '', diagnostic: 'ECONNREFUSED', fields: ['port']};
		const api = {save: jasmine.createSpy().and.returnValue(of(failure)), test: jasmine.createSpy().and.returnValue(of(failure))};
		TestBed.configureTestingModule({providers: [{provide: ServiceConfigService, useValue: api}]});
		const fixture = TestBed.createComponent(OnboardingConfigureComponent);
		fixture.componentRef.setInput('configuration', onboardingConfiguration(ServiceKind.Bitcoin));
		fixture.detectChanges();
		const applied = jasmine.createSpy();
		fixture.componentInstance.applied.subscribe(applied);
		fixture.componentInstance.submit(false);
		expect(applied).not.toHaveBeenCalled();
		expect(api.save).not.toHaveBeenCalled();
		fixture.componentInstance.submit(true);
		expect(applied).not.toHaveBeenCalled();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Save without a working connection');
		fixture.componentInstance.submit(true, true);
		expect(applied).toHaveBeenCalledWith(failure);
		fixture.componentRef.setInput('pending', true);
		fixture.detectChanges();
		api.save.calls.reset();
		fixture.componentInstance.submit(true);
		expect(api.save).not.toHaveBeenCalled();
	});
	it('allows a database warning and explains setup mode', () => {
		const check = {ok: true, warning: true, title: 'Database unavailable', context: '', fields: ['database'], mode: 'setup'};
		TestBed.configureTestingModule({
			providers: [{provide: ServiceConfigService, useValue: {test: () => of(check), save: () => of(check)}}],
		});
		const fixture = TestBed.createComponent(OnboardingConfigureComponent);
		fixture.componentRef.setInput('configuration', onboardingConfiguration(ServiceKind.Mint, true, 'environment'));
		fixture.detectChanges();
		const applied = jasmine.createSpy();
		fixture.componentInstance.applied.subscribe(applied);
		fixture.componentInstance.submit(false);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Federation setup after Review');
		expect(fixture.nativeElement.textContent).toContain('Filled in from your environment');
		fixture.componentInstance.submit(true);
		expect(applied).toHaveBeenCalledWith(check);
	});
});
