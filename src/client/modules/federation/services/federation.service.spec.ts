/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
/* Application Dependencies */
import {ApiService} from '@client/modules/api/services/api/api.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {FederationService} from './federation.service';

describe('FederationService', () => {
	let service: FederationService;
	let http: HttpTestingController;
	const config = {mint: {enabled: true, type: 'cdk'}};
	beforeEach(() => {
		config.mint.type = 'cdk';
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{provide: ApiService, useValue: {api: '/graphql'}},
				{provide: ConfigService, useValue: {config}},
			],
		});
		service = TestBed.inject(FederationService);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => {
		http.verify();
		localStorage.removeItem('v0.federation.backup.id');
		localStorage.removeItem('v0.federation.backup.warning');
	});
	it('retains the mint backup warning verbatim with its federation identity', () => {
		service.rememberBackupWarning('federation-123', 'Back up your private config.\nKeep it safe.');
		const restored = TestBed.runInInjectionContext(() => new FederationService());
		expect(restored.backup_warning()).toBe('Back up your private config.\nKeep it safe.');
		expect(restored.backup_federation_id()).toBe('federation-123');
	});
	it('enables standalone actions only after a successful standalone probe', () => {
		expect(service.standalone_actions()).toBeFalse();
		for (const mode of ['setup', 'member', 'unreachable', 'standalone']) {
			service.loadMode(true).subscribe();
			http.expectOne('/graphql').flush({data: {federation_mode: {mode, details: null}}});
			expect(service.standalone_actions()).toBe(mode === 'standalone');
		}
	});
	it('shares an in-flight probe and reuses a stable mode', () => {
		service.loadMode().subscribe();
		service.loadMode().subscribe();
		http.expectOne('/graphql').flush({data: {federation_mode: {mode: 'member', details: null}}});
		service.loadMode().subscribe();
		http.expectNone('/graphql');
	});
	it('keeps the last mode while a refresh is in flight', () => {
		service.loadMode().subscribe();
		http.expectOne('/graphql').flush({data: {federation_mode: {mode: 'unreachable', details: 'Connection refused'}}});
		service.loadMode(true).subscribe();
		expect(service.mode()).toBe('unreachable');
		expect(service.details()).toBe('Connection refused');
		http.expectOne('/graphql').flush({data: {federation_mode: {mode: 'setup', details: null}}});
		expect(service.mode()).toBe('setup');
	});
	it('preserves GraphQL diagnostics', () => {
		let error: OrchardErrors | undefined;
		service.loadMode().subscribe({error: (value: OrchardErrors) => (error = value)});
		http.expectOne('/graphql').flush({errors: [{message: 'Busy', extensions: {code: 40016, details: 'Too many status calls'}}]});
		expect(error?.errors[0].details).toBe('Too many status calls');
		expect(service.standalone_actions()).toBeFalse();
	});
	it('does not probe a Nutshell mint', () => {
		config.mint.type = 'nutshell';
		service.loadMode().subscribe();
		expect(service.mode()).toBe('standalone');
		expect(service.standalone_actions()).toBeTrue();
		http.expectNone('/graphql');
	});
});
