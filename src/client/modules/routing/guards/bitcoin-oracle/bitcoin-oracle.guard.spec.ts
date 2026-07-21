import {TestBed} from '@angular/core/testing';
import {CanMatchFn, Route, UrlSegment} from '@angular/router';

import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';

import {bitcoinOracleGuard} from './bitcoin-oracle.guard';

describe('bitcoinOracleGuard', () => {
	const executeGuard: CanMatchFn = (...guardParameters) => TestBed.runInInjectionContext(() => bitcoinOracleGuard(...guardParameters));

	let setting_app_service_mock: {getSetting: jasmine.Spy};

	const route = {} as Route;
	const segments = [] as UrlSegment[];

	beforeEach(() => {
		setting_app_service_mock = {getSetting: jasmine.createSpy('getSetting').and.returnValue({value: true})};
		TestBed.configureTestingModule({
			providers: [{provide: SettingAppService, useValue: setting_app_service_mock}],
		});
	});

	it('should be created', () => {
		expect(executeGuard).toBeTruthy();
	});

	it('should match the oracle route when the bitcoin_oracle setting is enabled', () => {
		expect(executeGuard(route, segments)).toBeTrue();
	});

	it('should not match the oracle route when the bitcoin_oracle setting is disabled', () => {
		setting_app_service_mock.getSetting.and.returnValue({value: false});
		expect(executeGuard(route, segments)).toBeFalse();
	});
});
