import {TestBed} from '@angular/core/testing';
import {CanMatchFn, Route, UrlSegment} from '@angular/router';

import {ConfigService} from '@client/modules/config/services/config.service';

import {mintMetricsGuard} from './mint-metrics.guard';

describe('mintMetricsGuard', () => {
	const executeGuard: CanMatchFn = (...guardParameters) => TestBed.runInInjectionContext(() => mintMetricsGuard(...guardParameters));

	let config_service_mock: {config: {mint: {metrics: boolean}}};

	const route = {} as Route;
	const segments = [] as UrlSegment[];

	beforeEach(() => {
		config_service_mock = {config: {mint: {metrics: true}}};
		TestBed.configureTestingModule({
			providers: [{provide: ConfigService, useValue: config_service_mock}],
		});
	});

	it('should be created', () => {
		expect(executeGuard).toBeTruthy();
	});

	it('should match the system route when mint metrics are configured', () => {
		expect(executeGuard(route, segments)).toBeTrue();
	});

	it('should not match the system route when mint metrics are not configured', () => {
		config_service_mock.config.mint.metrics = false;
		expect(executeGuard(route, segments)).toBeFalse();
	});
});
