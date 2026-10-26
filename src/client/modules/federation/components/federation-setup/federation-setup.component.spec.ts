import {MatDialog} from '@angular/material/dialog';
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
import {UserRole, type OrchardFederationSetupJoined, type OrchardFederationSetupStatus} from '@shared/generated.types';

describe('FederationSetupComponent', () => {
	const mode = signal<string | null>('setup');
	const details = signal<string | null>(null);
	let setup: jasmine.SpyObj<FederationSetupService>;
	let load_user: jasmine.Spy;
	let navigate: jasmine.Spy;
	let confirm: Subject<boolean>;
	beforeEach(() => {
		mode.set('setup');
		confirm = new Subject<boolean>();
		setup = jasmine.createSpyObj('setup', [
			'getStatus',
			'create',
			'join',
			'propose',
			'review',
			'approve',
			'activate',
			'abort',
			'replaceInvitation',
		]);
		setup.getStatus.and.returnValue(of(setupStatus()));
		setup.review.and.returnValue(of(setupProposal()));
		load_user = jasmine.createSpy().and.returnValue(of({role: UserRole.Admin}));
		navigate = jasmine.createSpy().and.resolveTo(true);
		TestBed.configureTestingModule({
			providers: [
				{provide: MatDialog, useValue: {open: () => ({afterClosed: () => confirm})}},
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
	it('never locks the forms for a poll, and an action cancels a poll in flight', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		const component = fixture.componentInstance;
		const pending = new Subject<OrchardFederationSetupStatus>();
		setup.getStatus.and.returnValue(pending);
		tick(3000);
		expect(pending.observed).toBeTrue();
		expect(component.busy()).toBeFalse();
		const joined = new Subject<OrchardFederationSetupJoined>();
		setup.join.and.returnValue(joined);
		component.join({invitation: 'secret'});
		expect(pending.observed).toBeFalse();
		expect(component.busy()).toBeTrue();
		const after_join = new Subject<OrchardFederationSetupStatus>();
		setup.getStatus.and.returnValue(after_join);
		joined.next({member_id: 2, setup_id: 'setup'});
		joined.complete();
		expect(component.busy()).toBeTrue();
		after_join.next(setupStatus());
		after_join.complete();
		expect(component.busy()).toBeFalse();
		fixture.destroy();
	}));
	it('holds the setup views until the daemon is known to be in setup', () => {
		mode.set(null);
		const component = TestBed.createComponent(FederationSetupComponent).componentInstance;
		expect(component.show_setup()).toBeFalse();
		mode.set('setup');
		expect(component.show_setup()).toBeTrue();
	});
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
		expect(navigate).toHaveBeenCalledOnceWith(['/mint/federation'], {onSameUrlNavigation: 'reload'});
	});
	it('holds create and replace invitations only on the current page and discards enrolled slots', fakeAsync(() => {
		const invitation = {member_id: 2, invitation: 'secret', expires_at_unix: '1792886400'};
		setup.create.and.returnValue(of({setup_id: 'setup', member_id: 1, invitations: [invitation]}));
		setup.replaceInvitation.and.returnValue(of({invitation: {...invitation, invitation: 'replacement'}}));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		const component = fixture.componentInstance;
		expect(component.invitation()).toBeNull();
		component.create({members: 3, threshold: 2, network: 'regtest'});
		expect(component.invitation()?.invitation).toBe('secret');
		component.replaceInvitation(2);
		expect(setup.replaceInvitation).not.toHaveBeenCalled();
		confirm.next(true);
		expect(component.invitation()?.invitation).toBe('replacement');
		setup.getStatus.and.returnValue(of({...setupStatus(), enrolled_members: [1, 2]}));
		tick(3000);
		expect(component.invitation()).toBeNull();
		fixture.destroy();
		expect(TestBed.createComponent(FederationSetupComponent).componentInstance.invitations()).toEqual([]);
	}));
	it('requires confirmation and follows the uninitialized status after abort', fakeAsync(() => {
		setup.abort.and.returnValue(of({setup_id: 'setup'}));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		const component = fixture.componentInstance;
		component.abort();
		tick(3000);
		expect(setup.getStatus).toHaveBeenCalledTimes(1);
		expect(setup.abort).not.toHaveBeenCalled();
		confirm.next(false);
		confirm.complete();
		expect(setup.abort).not.toHaveBeenCalled();
		confirm = new Subject<boolean>();
		component.abort();
		setup.getStatus.and.returnValue(
			of({...setupStatus(), initialized: false, setup_id: null, role: null, participant_phase: null, coordinator_phase: null}),
		);
		confirm.next(true);
		expect(setup.abort).toHaveBeenCalledOnceWith('setup');
		expect(component.view()).toBe('start');
		expect(component.can_abort()).toBeFalse();
		fixture.destroy();
	}));
	it('selects views from the new enum names and offers abort only before key generation', () => {
		const component = TestBed.createComponent(FederationSetupComponent).componentInstance;
		component.status.set(setupStatus());
		expect(component.view()).toBe('waiting');
		expect(component.can_abort()).toBeTrue();
		component.status.set({...setupStatus(), participant_phase: 'SETUP_PARTICIPANT_PHASE_DKG_RUNNING'});
		expect(component.view()).toBe('keygen');
		expect(component.can_abort()).toBeFalse();
		component.status.set({...setupStatus(), coordinator_phase: 'SETUP_COORDINATOR_PHASE_ABORTED'});
		expect(component.view()).toBe('aborted');
		expect(component.can_abort()).toBeTrue();
	});
});
