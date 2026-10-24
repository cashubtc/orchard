import {signal} from '@angular/core';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {Router} from '@angular/router';
import {of, Subject, throwError} from 'rxjs';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationSetupService} from '@client/modules/federation/services/federation-setup.service';
import {setupStatus, setupProposal} from '@client/modules/federation/helpers/federation-setup.fixtures';
import {FederationSetupComponent} from './federation-setup.component';
import {UserRole, type OrchardFederationSetupStatus} from '@shared/generated.types';

describe('FederationSetupComponent', () => {
	const mode = signal<string | null>('setup');
	const details = signal<string | null>(null);
	let setup: jasmine.SpyObj<FederationSetupService>;
	let load_user: jasmine.Spy;
	let navigate: jasmine.Spy;
	beforeEach(() => {
		mode.set('setup');
		setup = jasmine.createSpyObj('setup', ['getStatus', 'create', 'join', 'propose', 'review', 'approve', 'activate']);
		setup.getStatus.and.returnValue(of(setupStatus()));
		setup.review.and.returnValue(of(setupProposal()));
		load_user = jasmine.createSpy().and.returnValue(of({role: UserRole.Admin}));
		navigate = jasmine.createSpy().and.resolveTo(true);
		TestBed.configureTestingModule({
			providers: [
				{provide: FederationService, useValue: {mode, details, loadMode: () => of({mode: mode()})}},
				{provide: FederationSetupService, useValue: setup},
				{provide: CrewService, useValue: {loadUser: load_user}},
				{provide: Router, useValue: {navigate}},
			],
		});
		TestBed.overrideComponent(FederationSetupComponent, {set: {template: '', imports: []}});
	});
	it('resumes the waiting room and proposes only after all members enroll', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		const component = fixture.componentInstance;
		expect(component.view()).toBe('waiting');
		expect(component.can_propose()).toBeFalse();
		component.status.set({...setupStatus(), enrolled_members: [1, 2, 3], missing_enrollments: []});
		expect(component.can_propose()).toBeTrue();
		component.selected_member.set(9);
		expect(component.invitation()).toBeNull();
		fixture.destroy();
	}));
	it('does not request admin setup data for other roles', fakeAsync(() => {
		load_user.and.returnValue(of({role: UserRole.Reader}));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(3000);
		expect(setup.getStatus).not.toHaveBeenCalled();
		fixture.destroy();
	}));
	it('coalesces polls and cancels in-flight requests on navigation', fakeAsync(() => {
		const pending = new Subject<OrchardFederationSetupStatus>();
		setup.getStatus.and.returnValue(pending);
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		fixture.componentInstance.refresh();
		tick(6000);
		expect(setup.getStatus).toHaveBeenCalledTimes(1);
		fixture.destroy();
		expect(pending.observed).toBeFalse();
	}));
	it('loads a published proposal once and restores the review after refresh', fakeAsync(() => {
		setup.getStatus.and.returnValue(of({...setupStatus(), proposal_hash: 'hash'}));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(3000);
		expect(fixture.componentInstance.view()).toBe('review');
		expect(setup.review).toHaveBeenCalledTimes(1);
		fixture.destroy();
	}));
	it('clears a temporary status error after polling recovers', fakeAsync(() => {
		setup.getStatus.and.returnValue(
			throwError(() => new OrchardErrors([{message: 'Busy', extensions: {code: 40016, details: 'Try again'}}])),
		);
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		expect(fixture.componentInstance.error()).toEqual(jasmine.objectContaining({code: 40016, details: 'Try again'}));
		setup.getStatus.and.returnValue(of(setupStatus()));
		tick(3000);
		expect(fixture.componentInstance.error()).toBeNull();
		fixture.destroy();
	}));
	it('stops polling once the daemon is a federation member', fakeAsync(() => {
		mode.set('member');
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(6000);
		expect(setup.getStatus).not.toHaveBeenCalled();
		expect(fixture.componentInstance.loading()).toBeFalse();
		fixture.destroy();
	}));
	it('keeps the setup status when only the proposal fetch fails', fakeAsync(() => {
		setup.getStatus.and.returnValue(of({...setupStatus(), proposal_hash: 'hash'}));
		setup.review.and.returnValue(throwError(() => new OrchardErrors([{message: 'Busy', extensions: {code: 40016}}])));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		expect(fixture.componentInstance.status()?.proposal_hash).toBe('hash');
		expect(fixture.componentInstance.error()?.code).toBe(40016);
		fixture.destroy();
	}));
	it('does not activate before a finalized configuration is ready', () => {
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.componentInstance.status.set(setupStatus());
		fixture.componentInstance.activate();
		expect(setup.activate).not.toHaveBeenCalled();
	});
	it('requires backup acknowledgments and member mode before dashboard handoff', () => {
		const fixture = TestBed.createComponent(FederationSetupComponent);
		const component = fixture.componentInstance;
		component.openMint();
		expect(navigate).not.toHaveBeenCalled();
		component.backup_complete.set(true);
		component.openMint();
		expect(navigate).not.toHaveBeenCalled();
		mode.set('member');
		component.openMint();
		expect(navigate).toHaveBeenCalledOnceWith(['/mint']);
	});
});
