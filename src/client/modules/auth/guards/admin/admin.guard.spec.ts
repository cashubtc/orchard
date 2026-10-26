import {TestBed} from '@angular/core/testing';
import {provideRouter, Router, type ActivatedRouteSnapshot, type RouterStateSnapshot} from '@angular/router';
import {firstValueFrom, of, throwError, type Observable} from 'rxjs';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {UserRole} from '@shared/generated.types';
import {adminGuard} from './admin.guard';

describe('adminGuard', () => {
	const loadUser = jasmine.createSpy();
	beforeEach(() => TestBed.configureTestingModule({providers: [provideRouter([]), {provide: CrewService, useValue: {loadUser}}]}));
	const run = (): Promise<unknown> =>
		firstValueFrom(
			TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<unknown>,
		);
	it('allows administrators', async () => {
		loadUser.and.returnValue(of({role: UserRole.Admin}));
		expect(await run()).toBeTrue();
	});
	it('sends non-admins home', async () => {
		loadUser.and.returnValue(of({role: UserRole.Reader}));
		expect(await run()).toEqual(TestBed.inject(Router).createUrlTree(['/']));
	});
	it('does not grant access when the role request fails', async () => {
		loadUser.and.returnValue(throwError(() => new Error('offline')));
		expect(await run()).toEqual(TestBed.inject(Router).createUrlTree(['/']));
	});
});
