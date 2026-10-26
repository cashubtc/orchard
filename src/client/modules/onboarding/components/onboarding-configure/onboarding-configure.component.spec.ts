import {signal} from '@angular/core';
import {TestBed, type ComponentFixture} from '@angular/core/testing';
import {of} from 'rxjs';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {onboardingConfiguration} from '@client/modules/onboarding/helpers/onboarding.fixture';
import {ServiceKind} from '@shared/generated.types';
import {OnboardingConfigureComponent} from './onboarding-configure.component';

describe('OnboardingConfigureComponent', () => {
	/** Click the button with exactly this label, ignoring its icon's ligature text. */
	function click(fixture: ComponentFixture<OnboardingConfigureComponent>, label: string): void {
		Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
			.find((button) => button.textContent?.replace(button.querySelector('mat-icon')?.textContent ?? '', '').trim() === label)!
			.click();
		fixture.detectChanges();
	}

	it('tests without advancing, blocks failed saves, and advances after an explicit bypass', () => {
		const failure = {
			ok: false,
			warning: false,
			saved: false,
			title: 'Failed',
			context: '',
			diagnostic: 'ECONNREFUSED',
			fields: ['port'],
		};
		const bypassed = {...failure, saved: true};
		const api = {
			refresh_errors: signal({}),
			save: jasmine
				.createSpy()
				.and.callFake((_input: unknown, save_unreachable: boolean) => of(save_unreachable ? bypassed : failure)),
			test: jasmine.createSpy().and.returnValue(of(failure)),
		};
		TestBed.configureTestingModule({providers: [{provide: ServiceConfigService, useValue: api}]});
		const fixture = TestBed.createComponent(OnboardingConfigureComponent);
		fixture.componentRef.setInput('configuration', onboardingConfiguration(ServiceKind.Bitcoin));
		fixture.detectChanges();
		const applied = jasmine.createSpy();
		fixture.componentInstance.applied.subscribe(applied);
		click(fixture, 'Save and continue');
		expect(applied).not.toHaveBeenCalled();
		click(fixture, 'Test connection');
		expect(api.test).toHaveBeenCalled();
		expect(api.save).toHaveBeenCalledTimes(1);
		expect(applied).not.toHaveBeenCalled();
		click(fixture, 'Save anyway');
		expect(applied).toHaveBeenCalledWith(bypassed);
		fixture.componentRef.setInput('pending', true);
		fixture.detectChanges();
		api.save.calls.reset();
		click(fixture, 'Save anyway');
		expect(api.save).not.toHaveBeenCalled();
	});
	it('allows a database warning and scrolls its heading with the form', () => {
		const check = {
			ok: true,
			warning: true,
			saved: false,
			title: 'Database unavailable',
			context: '',
			fields: ['database'],
			mode: 'setup',
		};
		const stored = {...check, saved: true};
		TestBed.configureTestingModule({
			providers: [
				{provide: ServiceConfigService, useValue: {refresh_errors: signal({}), test: () => of(check), save: () => of(stored)}},
			],
		});
		const fixture = TestBed.createComponent(OnboardingConfigureComponent);
		fixture.componentRef.setInput('configuration', onboardingConfiguration(ServiceKind.Mint, true, 'environment'));
		fixture.detectChanges();
		const applied = jasmine.createSpy();
		fixture.componentInstance.applied.subscribe(applied);
		expect(fixture.nativeElement.querySelector('.connection-body > .configure-heading h2').textContent).toBe('Mint');
		click(fixture, 'Test connection');
		expect(fixture.nativeElement.querySelector('.orc-warning-card').textContent).toContain('Database unavailable');
		expect(fixture.nativeElement.querySelector('[aria-invalid="true"]')).toBeTruthy();
		click(fixture, 'Save and continue');
		expect(applied).toHaveBeenCalledWith(stored);
	});
});
