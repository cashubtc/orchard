/* Core Dependencies */
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import type {CanMatchFn, Route, UrlSegment} from '@angular/router';
/* Vendor Dependencies */
import {firstValueFrom, of, throwError, type Observable} from 'rxjs';
/* Application Dependencies */
import {AuthService} from '@client/modules/auth/services/auth/auth.service';
import {ConfigService} from '@client/modules/config/services/config.service';
/* Local Dependencies */
import {serviceStatusGuard} from './service-status.guard';

describe('serviceStatusGuard', () => {
	const executeGuard: CanMatchFn = (...guardParameters) => TestBed.runInInjectionContext(() => serviceStatusGuard(...guardParameters));
	const load_status = jasmine.createSpy('loadStatus');
	const auth = {isAuthenticated: jasmine.createSpy('isAuthenticated'), getRefreshToken: jasmine.createSpy('getRefreshToken')};

	beforeEach(() => {
		load_status.calls.reset();
		auth.isAuthenticated.and.returnValue(true);
		auth.getRefreshToken.and.returnValue(null);
		TestBed.configureTestingModule({
			providers: [
				{provide: ConfigService, useValue: {loadStatus: load_status}},
				{provide: AuthService, useValue: auth},
			],
		});
	});

	it('loads service flags before matching', async () => {
		load_status.and.returnValue(of(undefined));
		const result = executeGuard({} as Route, [] as UrlSegment[]) as Observable<boolean>;
		expect(await firstValueFrom(result)).toBeTrue();
		expect(load_status).toHaveBeenCalled();
	});

	it('leaves authentication to the activation guards without retrying', async () => {
		load_status.and.returnValue(throwError(() => ({type: 'auth_error'})));
		const result = executeGuard({} as Route, [] as UrlSegment[]) as Observable<boolean>;
		expect(await firstValueFrom(result)).toBeTrue();
		expect(load_status).toHaveBeenCalledTimes(1);
	});

	it('retries a transient failure before matching', fakeAsync(() => {
		load_status.and.returnValues(
			throwError(() => new Error('502')),
			of(undefined),
		);
		let matched: boolean | undefined;
		(executeGuard({} as Route, [] as UrlSegment[]) as Observable<boolean>).subscribe((value) => (matched = value));
		tick(1000);
		expect(matched).toBeTrue();
		expect(load_status).toHaveBeenCalledTimes(2);
	}));

	it('skips the query without a session', () => {
		auth.isAuthenticated.and.returnValue(false);
		expect(executeGuard({} as Route, [] as UrlSegment[])).toBeTrue();
		expect(load_status).not.toHaveBeenCalled();
	});
});
