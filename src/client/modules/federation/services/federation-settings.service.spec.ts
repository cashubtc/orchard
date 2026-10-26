import {TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
import {DateTime} from 'luxon';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {settingsComparison, settingsDifference} from '@client/modules/federation/helpers/federation-settings.fixtures';
import {federationSettingKey} from '@client/modules/federation/helpers/federation-settings.helpers';
import {FederationSettingsService} from './federation-settings.service';

describe('FederationSettingsService', () => {
	let service: FederationSettingsService;
	let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({providers: [{provide: ApiService, useValue: {api: '/graphql'}}]});
		service = TestBed.inject(FederationSettingsService);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());

	it('loads once, reuses a recent comparison across pages, and refreshes only on request', () => {
		const recent = {...settingsComparison(), checked_at: DateTime.now().toUnixInteger()};
		service.load();
		service.load();
		const first = http.expectOne('/graphql');
		expect(first.request.body.variables).toEqual({refresh: false});
		expect(first.request.body.query).toContain('default_quote_member_id');
		first.flush({data: {federation_settings_comparison: recent}});
		expect(service.comparison()).toEqual(recent);
		expect(service.loading()).toBeFalse();
		service.load();
		http.expectNone('/graphql');
		service.load(true);
		const refreshed = http.expectOne('/graphql');
		expect(refreshed.request.body.variables).toEqual({refresh: true});
		refreshed.flush({data: {federation_settings_comparison: recent}});
	});

	it('reads again once the comparison is older than a minute', () => {
		const stale = {...settingsComparison(), checked_at: DateTime.now().toUnixInteger() - 61};
		service.comparison.set(stale);
		service.load();
		http.expectOne('/graphql').flush({data: {federation_settings_comparison: settingsComparison()}});
		expect(service.comparison()).not.toBe(stale);
	});

	it('derives hints from the comparison', () => {
		const result = settingsComparison();
		result.members[1].differences = [settingsDifference()];
		service.comparison.set(result);
		expect(service.hints().get(federationSettingKey('max_amount', 4, 'bolt11', 'sat'))).toHaveSize(1);
	});

	it('keeps the Orchard error and removes a stale comparison on failure', () => {
		service.comparison.set(settingsComparison());
		service.load(true);
		http.expectOne('/graphql').flush({
			errors: [{message: 'Fetch failed', extensions: {code: 40016, details: 'ECONNREFUSED 127.0.0.1:3338\nRetry later'}}],
		});
		expect(service.comparison()).toBeNull();
		expect(service.error()).toEqual(jasmine.objectContaining({code: 40016, details: 'ECONNREFUSED 127.0.0.1:3338\nRetry later'}));
		expect(service.loading()).toBeFalse();
	});
});
