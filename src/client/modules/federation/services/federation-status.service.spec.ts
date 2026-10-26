import {TestBed} from '@angular/core/testing';
import {HttpTestingController} from '@angular/common/http/testing';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {FederationStatusService} from '@client/modules/federation/services/federation-status.service';
import {federationInfo, memberStatuses} from '@client/modules/federation/helpers/federation-status.fixtures';

describe('FederationStatusService', () => {
	let service: FederationStatusService;
	let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({providers: [{provide: ApiService, useValue: {api: '/graphql'}}]});
		service = TestBed.inject(FederationStatusService);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());
	it('stores the requested field and stamps the response time', () => {
		service.loadMemberStatuses().subscribe();
		http.expectOne('/graphql').flush({data: {federation_member_statuses: memberStatuses()}});
		expect(service.members()).toEqual(memberStatuses());
		expect(service.updated()).not.toBeNull();
	});
	it('keeps the Orchard error code and the daemon diagnostic, and clears it on the next success', () => {
		let completed = false;
		service.loadCustodyStatus().subscribe({complete: () => (completed = true)});
		http.expectOne('/graphql').flush({errors: [{message: 'Busy', extensions: {code: 40016, details: 'too many status requests'}}]});
		expect(completed).toBeTrue();
		expect(service.custody_error()).toEqual(jasmine.objectContaining({code: 40016, details: 'too many status requests'}));
		service.loadCustodyStatus().subscribe();
		http.expectOne('/graphql').flush({data: {federation_custody_status: {onchain_wallets: []}}});
		expect(service.custody_error()).toBeNull();
	});
	it('shares a read already in flight', () => {
		service.loadInfo().subscribe();
		service.loadInfo().subscribe();
		http.expectOne('/graphql').flush({data: {federation_info: federationInfo()}});
		service.loadInfo().subscribe();
		http.expectOne('/graphql').flush({data: {federation_info: federationInfo()}});
	});
	it('sends one status request at a time across callers', () => {
		service.loadLocalStatus().subscribe();
		const waiting = service.loadMemberStatuses().subscribe();
		const cancelled = service.loadCustodyStatus().subscribe();
		cancelled.unsubscribe();
		http.expectOne('/graphql').flush({errors: [{message: 'Busy', extensions: {code: 40016}}]});
		http.expectOne((request) => request.body.query.includes('federation_member_statuses')).flush({
			data: {federation_member_statuses: memberStatuses()},
		});
		http.expectNone('/graphql');
		expect(waiting.closed).toBeTrue();
	});
	it('derives development from custody and clears it when the federation changes', () => {
		service.loadInfo().subscribe();
		http.expectOne('/graphql').flush({data: {federation_info: federationInfo()}});
		service.loadCustodyStatus().subscribe();
		http.expectOne('/graphql').flush({data: {federation_custody_status: {onchain_wallets: []}}});
		expect(service.development()).toBeTrue();
		service.loadInfo().subscribe();
		http.expectOne('/graphql').flush({data: {federation_info: {...federationInfo(), federation_id: 'other'}}});
		expect(service.custody()).toBeNull();
		expect(service.development()).toBeFalse();
	});
});
