import {TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {FederationStatusService} from '@client/modules/federation/services/federation-status.service';
import {memberStatuses} from '@client/modules/federation/helpers/federation-status.fixtures';

describe('FederationStatusService', () => {
	let service: FederationStatusService;
	let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({providers: [{provide: ApiService, useValue: {api: '/graphql'}}]});
		service = TestBed.inject(FederationStatusService);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());
	it('returns the requested field', () => {
		let result: unknown;
		service.getMemberStatuses().subscribe((value) => (result = value));
		http.expectOne('/graphql').flush({data: {federation_member_statuses: memberStatuses()}});
		expect(result).toEqual(memberStatuses());
	});
	it('keeps the Orchard error code and the daemon diagnostic', () => {
		let error: unknown;
		service.getCustodyStatus().subscribe({error: (value: unknown) => (error = value)});
		http.expectOne('/graphql').flush({errors: [{message: 'Busy', extensions: {code: 40016, details: 'too many status requests'}}]});
		expect(error).toEqual(jasmine.any(OrchardErrors));
		expect((error as OrchardErrors).errors[0]).toEqual(jasmine.objectContaining({code: 40016, details: 'too many status requests'}));
	});
});
