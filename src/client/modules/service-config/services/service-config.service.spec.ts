import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {of} from 'rxjs';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {CacheService} from '@client/modules/cache/services/cache/cache.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {LightningService} from '@client/modules/lightning/services/lightning/lightning.service';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {ServiceKind} from '@shared/generated.types';
import {ServiceConfigService} from './service-config.service';

describe('ServiceConfigService', () => {
	it('refreshes runtime flags and the mint mode after saving, clearing only mint caches', () => {
		const status = jasmine.createSpy().and.returnValue(of(undefined));
		const mode = jasmine.createSpy().and.returnValue(of({mode: 'setup'}));
		const clear_cache = jasmine.createSpy();
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
		TestBed.inject(ServiceConfigService).save({service: ServiceKind.Mint, values: []}).subscribe();
		const http = TestBed.inject(HttpTestingController);
		http.expectOne('/api').flush({data: {service_configuration_save: {ok: true}}});
		expect(clear_cache.calls.allArgs()).toEqual([['mint-info']]);
		expect(status).toHaveBeenCalledWith(true);
		expect(mode).toHaveBeenCalledWith(true);
		http.verify();
	});
});
