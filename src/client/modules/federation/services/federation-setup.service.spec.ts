import {TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {FederationSetupService} from '@client/modules/federation/services/federation-setup.service';

describe('FederationSetupService', () => {
	let service: FederationSetupService;
	let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({providers: [{provide: ApiService, useValue: {api: '/graphql'}}]});
		service = TestBed.inject(FederationSetupService);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());
	it('sends amounts as strings and uses GraphQL variables for secrets', () => {
		const input = {
			members: 3,
			threshold: 2,
			network: 'regtest',
			keyset: {unit: 'sat', amounts: ['9007199254740993'], input_fee_ppk: '0'},
		};
		service.create(input).subscribe();
		const create = http.expectOne('/graphql');
		expect(create.request.body.variables).toEqual({input});
		create.flush({data: {federation_setup_create: {}}});
		service.join({invitation: 'secret'}).subscribe();
		const join = http.expectOne('/graphql');
		expect(join.request.body.query).not.toContain('secret');
		expect(join.request.body.variables.input.invitation).toBe('secret');
		join.flush({data: {federation_setup_join: {}}});
	});
	it('never caches status or invitation responses', () => {
		for (let index = 0; index < 2; index++) {
			service.getStatus().subscribe();
			http.expectOne('/graphql').flush({data: {federation_setup_status: {invitations: []}}});
		}
	});
	it('preserves actionable RPC diagnostics', () => {
		let received: OrchardErrors | undefined;
		service.approve('hash').subscribe({error: (error: OrchardErrors) => (received = error)});
		const request = http.expectOne('/graphql');
		expect(request.request.body.variables).toEqual({proposal_hash: 'hash'});
		request.flush({errors: [{message: 'Invalid argument', extensions: {code: 40008, details: 'Proposal hash mismatch'}}]});
		expect(received?.errors[0].details).toBe('Proposal hash mismatch');
	});
});
