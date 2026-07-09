import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot} from '@angular/router';

import {ConfigService} from '@client/modules/config/services/config.service';

import {enabledGuard} from './enabled.guard';

describe('enabledGuard', () => {
	const executeGuard: CanActivateFn = (...guardParameters) => TestBed.runInInjectionContext(() => enabledGuard(...guardParameters));

	let config_service_mock: {
		config: {bitcoin: {enabled: boolean}; lightning: {enabled: boolean}; mint: {enabled: boolean}};
	};
	let router_mock: {navigate: jasmine.Spy};

	const route = (data: Record<string, string>): ActivatedRouteSnapshot => ({data}) as unknown as ActivatedRouteSnapshot;
	const state = {} as RouterStateSnapshot;

	beforeEach(() => {
		config_service_mock = {
			config: {
				bitcoin: {enabled: true},
				lightning: {enabled: true},
				mint: {enabled: true},
			},
		};
		router_mock = {navigate: jasmine.createSpy('navigate')};
		TestBed.configureTestingModule({
			providers: [
				{provide: ConfigService, useValue: config_service_mock},
				{provide: Router, useValue: router_mock},
			],
		});
	});

	it('should be created', () => {
		expect(executeGuard).toBeTruthy();
	});

	it('should allow mint routes when the mint is enabled', () => {
		expect(executeGuard(route({section: 'mint', sub_section: 'dashboard'}), state)).toBeTrue();
	});

	it('should redirect to mint disabled when the mint is disabled', () => {
		config_service_mock.config.mint.enabled = false;
		expect(executeGuard(route({section: 'mint', sub_section: 'dashboard'}), state)).toBeFalse();
		expect(router_mock.navigate).toHaveBeenCalledWith(['/mint/disabled']);
	});
});
