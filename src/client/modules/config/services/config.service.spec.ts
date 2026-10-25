/* Core Dependencies */
import {computed} from '@angular/core';
import {HttpTestingController} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
/* Local Dependencies */
import {ConfigService} from './config.service';

describe('ConfigService', () => {
	let service: ConfigService;

	beforeEach(() => {
		TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
		service = TestBed.inject(ConfigService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});
});

describe('ConfigService runtime gating', () => {
	it('ignores an older status response after a configuration refresh', () => {
		TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
		const service = TestBed.inject(ConfigService);
		service.config = {...service.config, api: {proxy: '', path: 'api'}};
		const http = TestBed.inject(HttpTestingController);
		service.loadStatus().subscribe();
		const old_request = http.expectOne('/api');
		service.loadStatus(true).subscribe();
		http.expectOne('/api').flush({data: {service_status: []}});
		old_request.flush({data: {service_status: [{service: 'mint', enabled: true, type: 'cdk'}]}});
		expect(service.config.mint.enabled).toBeFalse();
		http.verify();
	});

	it('refreshes the existing config shape and reactive enabled flags from the server', () => {
		TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting()]});
		const service = TestBed.inject(ConfigService);
		service.config = {
			...service.config,
			api: {proxy: '', path: 'api'},
			bitcoin: {enabled: false},
			lightning: {enabled: false},
			mint: {
				enabled: false,
				type: 'cdk',
				database_type: 'sqlite',
				critical_path: '/v1/info',
				metrics: false,
				database: false,
				public_api: false,
			},
		};
		const enabled = computed(() => service.config.mint.enabled);
		expect(enabled()).toBeFalse();
		service.loadStatus().subscribe();
		const http = TestBed.inject(HttpTestingController);
		http.expectOne('/api').flush({
			data: {
				service_status: [
					{
						service: 'mint',
						enabled: true,
						type: 'nutshell',
						database: false,
						public_api: false,
						database_type: 'sqlite',
						metrics: false,
						source: 'orchard',
						status: 'connected',
					},
				],
			},
		});
		expect(enabled()).toBeTrue();
		expect(service.config.mint.type).toBe('nutshell');
		service.loadStatus().subscribe();
		http.expectNone('/api');
		service.loadStatus(true).subscribe();
		http.expectOne('/api').flush({data: {service_status: []}});
		expect(enabled()).toBeFalse();
		http.verify();
	});
});
