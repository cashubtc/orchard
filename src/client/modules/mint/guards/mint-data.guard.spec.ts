import {Component} from '@angular/core';
import {RouterTestingHarness} from '@angular/router/testing';
import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter} from '@angular/router';
import {ConfigService} from '@client/modules/config/services/config.service';
import {mintDataGuard} from './mint-data.guard';

describe('mintDataGuard', () => {
	const mint = {public_api: false, database: false};
	beforeEach(() =>
		TestBed.configureTestingModule({providers: [provideRouter([]), {provide: ConfigService, useValue: {config: {mint}}}]}),
	);
	it('passes the exact missing connection to the unavailable page', () => {
		for (const connection of ['public_api', 'database']) {
			const route = new ActivatedRouteSnapshot();
			route.data = {[`requires_${connection}`]: true};
			const result = TestBed.runInInjectionContext(() => mintDataGuard(route, {} as RouterStateSnapshot));
			expect(result).toEqual(TestBed.inject(Router).createUrlTree(['/mint/data-unavailable'], {queryParams: {connection}}));
		}
	});
	it('leaves management routes available without either optional data connection', () => {
		const route = new ActivatedRouteSnapshot();
		route.data = {};
		expect(TestBed.runInInjectionContext(() => mintDataGuard(route, {} as RouterStateSnapshot))).toBeTrue();
	});

	it('names both missing connections only when the requested page requires both', () => {
		const route = new ActivatedRouteSnapshot();
		route.data = {requires_public_api: true, requires_database: true};
		const result = TestBed.runInInjectionContext(() => mintDataGuard(route, {} as RouterStateSnapshot));
		expect(result).toEqual(TestBed.inject(Router).createUrlTree(['/mint/data-unavailable'], {queryParams: {connection: 'both'}}));
	});
});

@Component({template: ''})
class MintDataTestPage {}

describe('mintDataGuard navigation', () => {
	for (const database of [false, true])
		for (const public_api of [false, true]) {
			it(`resolves only when the required connection is available (database=${database}, public API=${public_api})`, async () => {
				const resolve = jasmine.createSpy('resolve').and.returnValue(null);
				TestBed.configureTestingModule({
					providers: [
						{provide: ConfigService, useValue: {config: {mint: {database, public_api}}}},
						provideRouter([
							{path: 'mint/data-unavailable', component: MintDataTestPage},
							{
								path: 'mint/database',
								component: MintDataTestPage,
								canActivate: [mintDataGuard],
								data: {requires_database: true},
								resolve: {data: resolve},
							},
							{
								path: 'mint/info',
								component: MintDataTestPage,
								canActivate: [mintDataGuard],
								data: {requires_public_api: true},
								resolve: {data: resolve},
							},
							{path: 'mint/federation', component: MintDataTestPage, canActivate: [mintDataGuard]},
						]),
					],
				});
				const harness = await RouterTestingHarness.create();
				await harness.navigateByUrl('/mint/database');
				expect(TestBed.inject(Router).url).toBe(database ? '/mint/database' : '/mint/data-unavailable?connection=database');
				expect(resolve.calls.count()).toBe(database ? 1 : 0);
				resolve.calls.reset();
				await harness.navigateByUrl('/mint/info');
				expect(TestBed.inject(Router).url).toBe(public_api ? '/mint/info' : '/mint/data-unavailable?connection=public_api');
				expect(resolve.calls.count()).toBe(public_api ? 1 : 0);
				await harness.navigateByUrl('/mint/federation');
				expect(TestBed.inject(Router).url).toBe('/mint/federation');
			});
		}
});
