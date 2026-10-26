import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {Subject, of, throwError} from 'rxjs';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {ServiceKind, type OrchardConnectionCheck} from '@shared/generated.types';
import {ServiceConfigService} from './service-config.service';

describe('ServiceConfigService', () => {
	const status = jasmine.createSpy();
	const mode = jasmine.createSpy();
	const clear_cache = jasmine.createSpy();
	let service: ServiceConfigService;
	let http: HttpTestingController;
	const saved: OrchardConnectionCheck = {ok: true, saved: true, warning: false, context: '', title: 'Connected', fields: []};

	beforeEach(() => {
		status.calls.reset();
		mode.calls.reset();
		clear_cache.calls.reset();
		status.and.returnValue(of(undefined));
		mode.and.returnValue(of({mode: 'setup'}));
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{provide: ApiService, useValue: {api: '/api'}},
				{provide: ConfigService, useValue: {loadStatus: status}},
				{provide: CacheService, useValue: {clearCache: clear_cache}},
				{provide: FederationService, useValue: {loadMode: mode}},
				{provide: BitcoinService, useValue: {CACHE_KEYS: {BLOCKCOUNT: 'bitcoin-blockcount'}}},
				{provide: LightningService, useValue: {CACHE_KEYS: {INFO: 'lightning-info'}}},
				{provide: MintService, useValue: {CACHE_KEYS: {INFO: 'mint-info'}}},
			],
		});
		service = TestBed.inject(ServiceConfigService);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());

	it('refreshes runtime flags and mint mode after saving, clearing only mint caches', () => {
		service.save({service: ServiceKind.Mint, values: []}).subscribe();
		http.expectOne('/api').flush({data: {service_configuration_save: saved}});
		expect(clear_cache.calls.allArgs()).toEqual([['mint-info']]);
		expect(status).toHaveBeenCalledWith(true);
		expect(mode).toHaveBeenCalledWith(true);
	});
	it('returns the confirmed saved result when refreshing status fails, and retries only the refresh', () => {
		status.and.returnValue(throwError(() => new Error('offline')));
		const result = jasmine.createSpy();
		const error = jasmine.createSpy();
		service.save({service: ServiceKind.Bitcoin, values: []}).subscribe({next: result, error});
		http.expectOne('/api').flush({data: {service_configuration_save: saved}});
		expect(result).toHaveBeenCalledWith(saved);
		expect(error).not.toHaveBeenCalled();
		expect(service.refresh_errors().bitcoin).toBeTruthy();
		status.and.returnValue(of(undefined));
		service.retry(ServiceKind.Bitcoin);
		expect(service.refresh_errors().bitcoin).toBeNull();
		expect(status).toHaveBeenCalledTimes(2);
		http.expectNone('/api');
	});
	it('finishes the save and refresh after an editor unsubscribes before the save returns', () => {
		const refresh = new Subject<void>();
		status.and.returnValue(refresh);
		const subscription = service.save({service: ServiceKind.Mint, values: []}).subscribe();
		const request = http.expectOne('/api');
		subscription.unsubscribe();
		expect(request.cancelled).toBeFalse();
		request.flush({data: {service_configuration_save: saved}});
		refresh.next();
		refresh.complete();
		expect(mode).toHaveBeenCalledWith(true);
		expect(service.saved_checks().mint?.saved).toBeTrue();
	});
	it('keeps an in-flight refresh alive when the editor is dismissed', () => {
		const refresh = new Subject<void>();
		status.and.returnValue(refresh);
		const subscription = service.save({service: ServiceKind.Mint, values: []}).subscribe();
		http.expectOne('/api').flush({data: {service_configuration_save: saved}});
		subscription.unsubscribe();
		refresh.next();
		refresh.complete();
		expect(mode).toHaveBeenCalledWith(true);
	});
	it('does not refresh or report success when the server refuses to save', () => {
		const result = jasmine.createSpy();
		service.save({service: ServiceKind.Mint, values: []}).subscribe(result);
		http.expectOne('/api').flush({data: {service_configuration_save: {...saved, ok: false, saved: false}}});
		expect(status).not.toHaveBeenCalled();
		expect(result).toHaveBeenCalledWith({...saved, ok: false, saved: false});
		expect(service.saved_checks().mint).toBeUndefined();
	});
});
