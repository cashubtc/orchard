/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {Router} from '@angular/router';
import {of} from 'rxjs';
/* Application Dependencies */
import {AuthService} from '@client/modules/auth/services/auth/auth.service';
/* Local Dependencies */
import {errorInterceptor} from './error.interceptor';

describe('errorInterceptor', () => {
	let http: HttpClient;
	let httpTesting: HttpTestingController;
	let authServiceSpy: jasmine.SpyObj<AuthService>;
	let routerSpy: jasmine.SpyObj<Router>;

	beforeEach(() => {
		authServiceSpy = jasmine.createSpyObj('AuthService', ['getAuthHeaders', 'getRefreshToken', 'refreshToken', 'clearAuthCache']);
		routerSpy = jasmine.createSpyObj('Router', ['navigate']);

		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptors([errorInterceptor])),
				provideHttpClientTesting(),
				{provide: AuthService, useValue: authServiceSpy},
				{provide: Router, useValue: routerSpy},
			],
		});

		http = TestBed.inject(HttpClient);
		httpTesting = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		httpTesting.verify();
	});

	it('should pass through responses without errors', () => {
		http.get('/api/test').subscribe((response) => {
			expect(response).toBeTruthy();
		});

		const req = httpTesting.expectOne('/api/test');
		req.flush({data: 'ok'});
	});

	it('should clear auth and navigate to /auth on refresh error (code 10003)', () => {
		http.get('/api/test', {observe: 'response'}).subscribe({
			error: () => {
				expect(authServiceSpy.clearAuthCache).toHaveBeenCalled();
				expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth']);
			},
		});

		const req = httpTesting.expectOne('/api/test');
		req.flush({errors: [{extensions: {code: 10003}}]});
	});

	it('should attempt token refresh on auth error (code 10002) when the request carried a token', () => {
		authServiceSpy.getRefreshToken.and.returnValue('refresh-token');
		authServiceSpy.getAuthHeaders.and.returnValue({Authorization: 'Bearer new-token'});
		authServiceSpy.refreshToken.and.returnValue(of({} as any));

		http.get('/api/test', {observe: 'response', headers: {Authorization: 'Bearer stale-token'}}).subscribe();

		const req = httpTesting.expectOne('/api/test');
		req.flush({errors: [{extensions: {code: 10002}}]});

		const retried_req = httpTesting.expectOne('/api/test');
		retried_req.flush({data: 'ok'});
	});

	it('should propagate an auth error (code 10002) on an anonymous request without refreshing or redirecting', () => {
		let errored = false;
		http.get('/api/test', {observe: 'response'}).subscribe({
			error: () => {
				errored = true;
			},
		});

		const req = httpTesting.expectOne('/api/test');
		req.flush({errors: [{extensions: {code: 10002}}]});

		// No token was on the request — not an expired session: no refresh
		// attempt, no /auth redirect (would clobber pre-auth deep links like
		// /auth/signup/:key), error surfaced to the caller.
		expect(errored).toBeTrue();
		expect(authServiceSpy.refreshToken).not.toHaveBeenCalled();
		expect(routerSpy.navigate).not.toHaveBeenCalled();
	});
});
