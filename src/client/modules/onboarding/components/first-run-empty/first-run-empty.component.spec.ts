import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {UserRole} from '@shared/generated.types';
import {OnboardingFirstRunEmptyComponent} from './first-run-empty.component';

describe('OnboardingFirstRunEmptyComponent', () => {
	for (const role of [UserRole.Admin, UserRole.Reader]) {
		it(`shows setup actions only to admins (${role})`, () => {
			TestBed.configureTestingModule({
				providers: [provideRouter([]), {provide: CrewService, useValue: {isAdmin: () => of(role === UserRole.Admin)}}],
			});
			const fixture = TestBed.createComponent(OnboardingFirstRunEmptyComponent);
			fixture.detectChanges();
			expect(fixture.nativeElement.textContent).toContain('Nothing connected yet');
			expect(fixture.nativeElement.querySelectorAll('a').length).toBe(role === UserRole.Admin ? 6 : 0);
			if (role === UserRole.Admin) {
				const tile: HTMLAnchorElement = fixture.nativeElement.querySelector('a[aria-label="Add Mint"]');
				expect(tile.getAttribute('href')).toBe('/onboarding/configure/mint');
				expect(tile.textContent).toContain('CDK or Nutshell, standalone or a federation member.');
				const ecash: HTMLAnchorElement = fixture.nativeElement.querySelector('a[aria-label="Add Ecash wallet"]');
				expect(ecash.getAttribute('href')).toBe('/onboarding/services?picked=ecash');
				expect(ecash.textContent).not.toContain('Add a mint first');
			}
		});
	}
});
