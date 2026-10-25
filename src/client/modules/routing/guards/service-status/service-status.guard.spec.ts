/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
import type {CanMatchFn, Route, UrlSegment} from '@angular/router';
/* Vendor Dependencies */
import {firstValueFrom, of, throwError, type Observable} from 'rxjs';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
/* Local Dependencies */
import {serviceStatusGuard} from './service-status.guard';

describe('serviceStatusGuard', () => {
	const executeGuard: CanMatchFn = (...guardParameters) => TestBed.runInInjectionContext(() => serviceStatusGuard(...guardParameters));
	const load_status = jasmine.createSpy('loadStatus');

	beforeEach(() => {
		load_status.calls.reset();
		TestBed.configureTestingModule({providers: [{provide: ConfigService, useValue: {loadStatus: load_status}}]});
	});

	it('loads service flags before matching', async () => {
		load_status.and.returnValue(of(undefined));
		const result = executeGuard({} as Route, [] as UrlSegment[]) as Observable<boolean>;
		expect(await firstValueFrom(result)).toBeTrue();
		expect(load_status).toHaveBeenCalled();
	});

	it('leaves authentication to the activation guards when loading fails', async () => {
		load_status.and.returnValue(throwError(() => new Error('unauthenticated')));
		const result = executeGuard({} as Route, [] as UrlSegment[]) as Observable<boolean>;
		expect(await firstValueFrom(result)).toBeTrue();
	});
});
