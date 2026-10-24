import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, type ParamMap} from '@angular/router';
import {BehaviorSubject, of, Subject, throwError} from 'rxjs';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {FederationStatusService} from '@client/modules/federation/services/federation-status.service';
import {federationInfo, localStatus, memberStatuses} from '@client/modules/federation/helpers/federation-status.fixtures';
import {FederationDashboardComponent} from './federation-dashboard.component';
import type {OrchardFederationMemberStatuses} from '@shared/generated.types';

describe('FederationDashboardComponent', () => {
	let service: jasmine.SpyObj<FederationStatusService>;
	let params: BehaviorSubject<ParamMap>;
	beforeEach(() => {
		service = jasmine.createSpyObj('status', ['getInfo', 'getLocalStatus', 'getMemberStatuses', 'getCustodyStatus']);
		service.getInfo.and.returnValue(of(federationInfo()));
		service.getLocalStatus.and.returnValue(of(localStatus()));
		service.getMemberStatuses.and.returnValue(of(memberStatuses()));
		service.getCustodyStatus.and.returnValue(of({onchain_wallets: []}));
		params = new BehaviorSubject(convertToParamMap({}));
		TestBed.configureTestingModule({
			providers: [
				{provide: FederationStatusService, useValue: service},
				{provide: MintService, useValue: {mint_info$: of(null)}},
				{provide: ActivatedRoute, useValue: {queryParamMap: params}},
			],
		});
		TestBed.overrideComponent(FederationDashboardComponent, {set: {template: '', imports: []}});
	});
	it('polls every six seconds, reads info once and stops on navigation', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		expect(service.getMemberStatuses).toHaveBeenCalledTimes(1);
		tick(5999);
		expect(service.getMemberStatuses).toHaveBeenCalledTimes(1);
		tick(1);
		expect(service.getMemberStatuses).toHaveBeenCalledTimes(2);
		expect(service.getInfo).toHaveBeenCalledTimes(1);
		fixture.destroy();
		tick(12000);
		expect(service.getMemberStatuses).toHaveBeenCalledTimes(2);
	}));
	it('reads only the sources the selected view shows', fakeAsync(() => {
		params.next(convertToParamMap({view: 'consensus'}));
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		expect(fixture.componentInstance.view()).toBe('consensus');
		expect(service.getLocalStatus).toHaveBeenCalledTimes(1);
		expect(service.getCustodyStatus).not.toHaveBeenCalled();
		expect(service.getMemberStatuses).not.toHaveBeenCalled();
		params.next(convertToParamMap({view: 'custody'}));
		tick(0);
		expect(service.getCustodyStatus).toHaveBeenCalledTimes(1);
		expect(service.getLocalStatus).toHaveBeenCalledTimes(1);
		params.next(convertToParamMap({view: 'backup'}));
		tick(6000);
		expect(fixture.componentInstance.view()).toBe('backup');
		expect(service.getCustodyStatus).toHaveBeenCalledTimes(1);
		expect(service.getLocalStatus).toHaveBeenCalledTimes(1);
		expect(service.getInfo).toHaveBeenCalledTimes(1);
		fixture.destroy();
	}));
	it('skips polls while the browser tab is hidden', fakeAsync(() => {
		const hidden = spyOnProperty(document, 'hidden').and.returnValue(true);
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(6000);
		expect(service.getMemberStatuses).not.toHaveBeenCalled();
		hidden.and.returnValue(false);
		tick(6000);
		expect(service.getMemberStatuses).toHaveBeenCalledTimes(1);
		fixture.destroy();
	}));
	it('does not overlap slow polls and cancels active requests', fakeAsync(() => {
		const pending = new Subject<OrchardFederationMemberStatuses>();
		service.getMemberStatuses.and.returnValue(pending);
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(12000);
		expect(service.getMemberStatuses).toHaveBeenCalledTimes(1);
		fixture.destroy();
		expect(pending.observed).toBeFalse();
	}));
	it('keeps other panels usable, preserves error codes and retries info until it loads', fakeAsync(() => {
		const busy = new OrchardErrors([{message: 'Busy', extensions: {code: 40016, details: 'Status request busy'}}]);
		service.getCustodyStatus.and.returnValue(throwError(() => busy));
		service.getInfo.and.returnValue(throwError(() => busy));
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		expect(fixture.componentInstance.members()).toBeTruthy();
		expect(fixture.componentInstance.errors()['Custody'].code).toBe(40016);
		expect(fixture.componentInstance.errors()['Federation info'].code).toBe(40016);
		service.getInfo.and.returnValue(of(federationInfo()));
		tick(6000);
		expect(fixture.componentInstance.info()).toBeTruthy();
		expect(fixture.componentInstance.errors()['Federation info']).toBeUndefined();
		expect(service.getInfo).toHaveBeenCalledTimes(2);
		fixture.destroy();
	}));
});
