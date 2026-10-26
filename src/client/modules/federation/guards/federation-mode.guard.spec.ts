/* Core Dependencies */
import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router, RouterOutlet} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
/* Vendor Dependencies */
import {of, throwError} from 'rxjs';
/* Native Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
import {federationModeGuard} from './federation-mode.guard';

@Component({template: '<router-outlet />', imports: [RouterOutlet]})
class TestPage {}

describe('federationModeGuard navigation', () => {
	let load_mode: jasmine.Spy;
	let mint_resolver: jasmine.Spy;
	beforeEach(() => {
		load_mode = jasmine.createSpy();
		mint_resolver = jasmine.createSpy().and.returnValue(of({}));
		TestBed.configureTestingModule({
			providers: [
				{provide: FederationService, useValue: {loadMode: load_mode}},
				provideRouter([
					{path: 'mint/federation', component: TestPage},
					{
						path: 'mint',
						component: TestPage,
						canActivateChild: [federationModeGuard],
						children: [{path: 'info', component: TestPage, resolve: {mint: mint_resolver}}],
					},
				]),
			],
		});
	});
	it('redirects setup mode before running mint resolvers', async () => {
		load_mode.and.returnValue(of({mode: 'setup', details: null}));
		const harness = await RouterTestingHarness.create();
		await harness.navigateByUrl('/mint/info');
		expect(TestBed.inject(Router).url).toBe('/mint/federation');
		expect(mint_resolver).not.toHaveBeenCalled();
	});
	for (const mode of ['member', 'standalone', 'unreachable'])
		it(`allows ${mode} to resolve the mint page`, async () => {
			load_mode.and.returnValue(of({mode, details: null}));
			const harness = await RouterTestingHarness.create();
			await harness.navigateByUrl('/mint/info');
			expect(TestBed.inject(Router).url).toBe('/mint/info');
			expect(mint_resolver).toHaveBeenCalled();
		});
	it('leaves authentication redirects to the interceptor', async () => {
		load_mode.and.returnValue(throwError(() => ({type: 'auth_error'})));
		const harness = await RouterTestingHarness.create();
		await harness.navigateByUrl('/mint/info');
		expect(mint_resolver).not.toHaveBeenCalled();
		expect(TestBed.inject(Router).url).not.toBe('/mint/federation');
	});
	it('keeps the mint page when the probe fails, leaving errors to the page', async () => {
		load_mode.and.returnValue(throwError(() => new Error('busy')));
		const harness = await RouterTestingHarness.create();
		await harness.navigateByUrl('/mint/info');
		expect(TestBed.inject(Router).url).toBe('/mint/info');
		expect(mint_resolver).toHaveBeenCalled();
	});
});
