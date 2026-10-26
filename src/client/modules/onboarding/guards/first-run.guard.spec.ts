/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
import type {CanMatchFn, Route, UrlSegment} from '@angular/router';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';
/* Local Dependencies */
import {firstRunGuard} from './first-run.guard';

describe('firstRunGuard', () => {
	const executeGuard: CanMatchFn = (...guardParameters) => TestBed.runInInjectionContext(() => firstRunGuard(...guardParameters));
	const config = {bitcoin: {enabled: false}, lightning: {enabled: false}, mint: {enabled: false}, taproot_assets: {enabled: false}};
	const config_service = {config, status_loaded: true};

	beforeEach(() => {
		config.mint.enabled = false;
		config_service.status_loaded = true;
		TestBed.configureTestingModule({providers: [{provide: ConfigService, useValue: config_service}]});
	});

	it('does not invite onboarding when the service flags failed to load', () => {
		config_service.status_loaded = false;
		expect(executeGuard({} as Route, [] as UrlSegment[])).toBeFalse();
	});

	it('matches while nothing is connected', () => {
		expect(executeGuard({} as Route, [] as UrlSegment[])).toBeTrue();
	});

	it('falls through to the dashboard once any service is connected', () => {
		config.mint.enabled = true;
		expect(executeGuard({} as Route, [] as UrlSegment[])).toBeFalse();
	});
});
