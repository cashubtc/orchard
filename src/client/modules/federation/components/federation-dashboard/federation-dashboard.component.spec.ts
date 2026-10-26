import {signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {ActivatedRoute, provideRouter, convertToParamMap, type ParamMap} from '@angular/router';
import {BehaviorSubject, map, of, Subject, throwError, timer, type Observable} from 'rxjs';
import {ApiService} from '@client/modules/api/services/api/api.service';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {FederationSettingsService} from '@client/modules/federation/services/federation-settings.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationStatusService} from '@client/modules/federation/services/federation-status.service';
import {federationInfo, localStatus, memberStatuses} from '@client/modules/federation/helpers/federation-status.fixtures';
import {FederationDashboardComponent} from './federation-dashboard.component';

const FIELDS = ['federation_info', 'federation_local_status', 'federation_member_statuses', 'federation_custody_status'] as const;
type Field = (typeof FIELDS)[number];

describe('FederationDashboardComponent', () => {
	let responses: Record<Field, () => Observable<unknown>>;
	let post: jasmine.Spy;
	let load_settings: jasmine.Spy;
	let log: string[];
	let hidden: jasmine.Spy;
	let params: BehaviorSubject<ParamMap>;
	const busy = {errors: [{message: 'Busy', extensions: {code: 40016, details: 'Status request busy'}}]};
	const calls = (field: Field): number => post.calls.allArgs().filter(([, body]) => body.query.includes(field)).length;
	const data = (field: Field, value: unknown) => () => of({data: {[field]: value}});
	beforeEach(() => {
		responses = {
			federation_info: data('federation_info', federationInfo()),
			federation_local_status: data('federation_local_status', localStatus()),
			federation_member_statuses: data('federation_member_statuses', memberStatuses()),
			federation_custody_status: data('federation_custody_status', {onchain_wallets: []}),
		};
		params = new BehaviorSubject(convertToParamMap({}));
		TestBed.configureTestingModule({
			providers: [
				{provide: ApiService, useValue: {api: '/graphql'}},
				{provide: MintService, useValue: {mint_info$: of(null)}},
				provideRouter([]),
				{
					provide: FederationService,
					useValue: {backup_warning: signal('Back up the private config'), backup_federation_id: signal('federation')},
				},
			],
		});
		log = [];
		post = spyOn(TestBed.inject(HttpClient), 'post').and.callFake(((_url: string, body: {query: string}) => {
			const field = FIELDS.find((key) => body.query.includes(key))!;
			log.push(field);
			return responses[field]();
		}) as never);
		load_settings = spyOn(TestBed.inject(FederationSettingsService), 'load').and.callFake(() => {
			log.push('settings');
		});
		spyOnProperty(TestBed.inject(ActivatedRoute), 'queryParamMap').and.returnValue(params);
		hidden = spyOnProperty(document, 'hidden').and.returnValue(false);
	});
	it('polls every six seconds, reads info once and stops on navigation', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		expect(calls('federation_member_statuses')).toBe(1);
		tick(5999);
		expect(calls('federation_member_statuses')).toBe(1);
		tick(1);
		expect(calls('federation_member_statuses')).toBe(2);
		expect(calls('federation_info')).toBe(1);
		fixture.destroy();
		tick(12000);
		expect(calls('federation_member_statuses')).toBe(2);
	}));
	it('reads members in step with the interval even when earlier reads are slow', fakeAsync(() => {
		responses.federation_local_status = () => timer(1500).pipe(map(() => ({data: {federation_local_status: localStatus()}})));
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(1500);
		expect(calls('federation_member_statuses')).toBe(1);
		tick(6000);
		expect(calls('federation_member_statuses')).toBe(2);
		fixture.destroy();
	}));
	it('compares settings once, only on Overview and after its own reads', fakeAsync(() => {
		params.next(convertToParamMap({view: 'consensus'}));
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(6000);
		expect(load_settings).not.toHaveBeenCalled();
		params.next(convertToParamMap({view: 'overview'}));
		tick(0);
		expect(load_settings).toHaveBeenCalledTimes(1);
		expect(log.slice(-4)).toEqual(['federation_member_statuses', 'federation_custody_status', 'federation_local_status', 'settings']);
		tick(12000);
		expect(load_settings).toHaveBeenCalledTimes(1);
		fixture.destroy();
	}));
	it('reads only the sources the selected view shows', fakeAsync(() => {
		params.next(convertToParamMap({view: 'consensus'}));
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		expect(fixture.componentInstance.view()).toBe('consensus');
		expect(calls('federation_local_status')).toBe(1);
		expect(calls('federation_custody_status')).toBe(1);
		expect(calls('federation_member_statuses')).toBe(0);
		params.next(convertToParamMap({view: 'custody'}));
		tick(0);
		expect(calls('federation_custody_status')).toBe(2);
		expect(calls('federation_local_status')).toBe(1);
		params.next(convertToParamMap({view: 'backup'}));
		tick(6000);
		expect(fixture.componentInstance.view()).toBe('backup');
		expect(calls('federation_custody_status')).toBe(2);
		expect(calls('federation_local_status')).toBe(1);
		expect(calls('federation_info')).toBe(1);
		fixture.destroy();
	}));
	it('stops the timer while the browser tab is hidden and reads once on return', fakeAsync(() => {
		hidden.and.returnValue(true);
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(12000);
		expect(post).not.toHaveBeenCalled();
		hidden.and.returnValue(false);
		document.dispatchEvent(new Event('visibilitychange'));
		tick(0);
		expect(calls('federation_member_statuses')).toBe(1);
		expect(calls('federation_local_status')).toBe(1);
		tick(5999);
		expect(calls('federation_local_status')).toBe(1);
		fixture.destroy();
	}));
	it('does not overlap slow polls and cancels active requests', fakeAsync(() => {
		const pending = new Subject<unknown>();
		responses.federation_member_statuses = () => pending;
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(12000);
		expect(calls('federation_member_statuses')).toBe(1);
		fixture.destroy();
		expect(pending.observed).toBeFalse();
	}));
	it('keeps other panels usable, preserves error codes and retries info until it loads', fakeAsync(() => {
		responses.federation_custody_status = () => of(busy);
		responses.federation_info = () => of(busy);
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		expect(fixture.componentInstance.members()).toBeTruthy();
		expect(fixture.componentInstance.custody_error()?.code).toBe(40016);
		expect(fixture.componentInstance.info_error()?.code).toBe(40016);
		responses.federation_info = data('federation_info', federationInfo());
		tick(6000);
		expect(fixture.componentInstance.info()).toBeTruthy();
		expect(fixture.componentInstance.info_error()).toBeNull();
		expect(calls('federation_info')).toBe(2);
		fixture.destroy();
	}));
	it('renders development from absent custody and marks only the selected tab current', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Development federation');
		expect(fixture.nativeElement.querySelectorAll('a[aria-current="page"]').length).toBe(1);
		expect(fixture.nativeElement.querySelector('a[aria-current="page"]').textContent).toContain('Overview');
		params.next(convertToParamMap({view: 'custody'}));
		tick(0);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('a[aria-current="page"]').textContent).toContain('Custody');
		expect(fixture.nativeElement.querySelectorAll('[data-testid="federation-custody-off"]').length).toBe(0);
		fixture.destroy();
	}));
	it('renders refresh failures in their own panels while retaining successful data', fakeAsync(() => {
		responses.federation_custody_status = () => throwError(() => new Error('custody unavailable'));
		responses.federation_member_statuses = () => throwError(() => new Error('members unavailable'));
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		fixture.detectChanges();
		const custody = fixture.nativeElement.querySelector('[aria-label="Custody refresh error"]');
		const members = fixture.nativeElement.querySelector('[aria-label="Members refresh error"]');
		expect(custody.closest('section.panel').querySelector('h2').textContent).toBe('Payments');
		expect(members.closest('section.panel').querySelector('h2').textContent).toBe('Members');
		expect(fixture.nativeElement.querySelector('.health-grid').textContent).toContain('Healthy');
		params.next(convertToParamMap({view: 'consensus'}));
		tick(0);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[aria-label="Members refresh error"]')).toBeNull();
		fixture.destroy();
	}));
	it('does not ask members twice within five seconds when views change quickly', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		params.next(convertToParamMap({view: 'consensus'}));
		tick(1600);
		params.next(convertToParamMap({view: 'overview'}));
		tick(0);
		expect(calls('federation_member_statuses')).toBe(1);
		tick(6000);
		expect(calls('federation_member_statuses')).toBe(2);
		fixture.destroy();
	}));
	it('keeps the status in the shared store for the mint header', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		const store = TestBed.inject(FederationStatusService);
		expect(store.custody()).toEqual({onchain_wallets: []});
		expect(store.development()).toBeTrue();
		fixture.destroy();
	}));
	it('renders a backup heading and only the current federation warning', fakeAsync(() => {
		params.next(convertToParamMap({view: 'backup'}));
		const fixture = TestBed.createComponent(FederationDashboardComponent);
		fixture.detectChanges();
		tick(0);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Federation backup checklist');
		expect(fixture.nativeElement.querySelector('.backup-warning').textContent).toBe('Back up the private config');
		TestBed.inject(FederationService).backup_federation_id.set('other');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.backup-warning')).toBeNull();
		fixture.destroy();
	}));
});
