import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {UserRole} from '@shared/generated.types';
import {FirstRunEmptyComponent} from './first-run-empty.component';

describe('FirstRunEmptyComponent', () => {
	for (const role of [UserRole.Admin, UserRole.Reader]) {
		it(`shows setup actions only to admins (${role})`, () => {
			TestBed.configureTestingModule({
				providers: [provideRouter([]), {provide: CrewService, useValue: {loadUser: () => of({role})}}],
			});
			const fixture = TestBed.createComponent(FirstRunEmptyComponent);
			fixture.detectChanges();
			expect(fixture.nativeElement.textContent).toContain('Nothing connected yet');
			expect(fixture.nativeElement.querySelectorAll('a').length).toBe(role === UserRole.Admin ? 5 : 0);
			if (role === UserRole.Admin)
				expect(fixture.nativeElement.querySelector('a[aria-label="Add Mint"]').getAttribute('href')).toBe(
					'/onboarding?service=mint',
				);
		});
	}
});
