import {MatDialog} from '@angular/material/dialog';
import {signal} from '@angular/core';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {of, Subject, throwError, map} from 'rxjs';
import {DateTime} from 'luxon';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationSetupService} from '@client/modules/federation/services/federation-setup.service';
import {setupStatus, setupProposal} from '@client/modules/federation/helpers/federation-setup.fixtures';
import {FederationSetupComponent} from './federation-setup.component';
import {UserRole, type OrchardFederationSetupJoined, type OrchardFederationSetupStatus} from '@shared/generated.types';

/** Visible labels of the buttons inside an element. */
/** Button labels without their icons' ligature text. */
function buttonTexts(element: Element): string[] {
	return Array.from(element.querySelectorAll('button')).map(
		(button) => button.textContent?.replace(button.querySelector('mat-icon')?.textContent ?? '', '').trim() ?? '',
	);
}

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
				provideRouter([]),
				{provide: MatDialog, useValue: {open: () => ({afterClosed: () => confirm})}},
				{
					provide: FederationService,
					useValue: {mode, details, loadMode: () => of({mode: mode()}), rememberBackupWarning: jasmine.createSpy()},
				},
				{provide: FederationSetupService, useValue: setup},
				{
					provide: CrewService,
					useValue: {isAdmin: () => load_user().pipe(map((user: {role: UserRole}) => user.role === UserRole.Admin))},
				},
			],
		});
		TestBed.overrideComponent(FederationSetupComponent, {
			add: {providers: [{provide: MatDialog, useValue: {open: () => ({afterClosed: () => confirm})}}]},
		});
		navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
		spyOnProperty(document, 'hidden').and.returnValue(false);
	});
	it('keeps Create and Join hidden while the mode is unknown, with an empty announcement region', fakeAsync(() => {
		mode.set(null);
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.setup-intro')).toBeNull();
		expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
		fixture.destroy();
	}));
	it('renders the mint diagnostic above the current view and identifies the current step', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		fixture.componentInstance.error.set({code: 40016, message: 'Busy', details: 'Mint says wait'});
		fixture.detectChanges();
		const alert: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
		expect(alert.textContent).toContain('Mint says wait');
		expect(alert.compareDocumentPosition(fixture.nativeElement.querySelector('h1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(fixture.nativeElement.querySelector('[aria-current="step"]').textContent).toContain('Enroll');
		fixture.destroy();
	}));
	it('refreshes immediately when a hidden tab becomes visible', fakeAsync(() => {
		const hidden = Object.getOwnPropertyDescriptor(document, 'hidden')!.get as jasmine.Spy;
		hidden.and.returnValue(true);
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(6000);
		expect(setup.getStatus).not.toHaveBeenCalled();
		hidden.and.returnValue(false);
		document.dispatchEvent(new Event('visibilitychange'));
		expect(setup.getStatus).toHaveBeenCalledTimes(1);
		fixture.destroy();
	}));
	it('blocks copying expired invitations and clears the selection feedback after enrollment', fakeAsync(() => {
		const invitation = {member_id: 2, invitation: 'secret', expires_at_unix: '1'};
		setup.create.and.returnValue(of({setup_id: 'setup', member_id: 1, invitations: [invitation]}));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		const component = fixture.componentInstance;
		component.create({members: 3, threshold: 2, network: 'regtest'});
		fixture.detectChanges();
		expect(component.invitation_expired()).toBeTrue();
		const panel: HTMLElement = fixture.nativeElement.querySelector('#invitation-2');
		// The QR code's own expand button has no text
		const invitation_actions = Array.from<HTMLButtonElement>(panel.querySelectorAll('button')).filter((button) =>
			/Copy|Save file/.test(button.textContent ?? ''),
		);
		expect(buttonTexts(panel).filter(Boolean)).toEqual(['Copy', 'Save file', 'Replace invitation']);
		expect(invitation_actions.length).toBe(2);
		expect(invitation_actions.every((button) => button.disabled)).toBeTrue();
		// The invitation opens under its own row
		expect(panel.closest('[data-testid="member-slot"]')?.querySelector('button[aria-expanded="true"]')).not.toBeNull();
		component.copy_result.set('Copied');
		setup.getStatus.and.returnValue(of({...setupStatus(), enrolled_members: [1, 2]}));
		tick(3000);
		expect(component.selected_member()).toBeNull();
		expect(component.copy_result()).toBeNull();
		fixture.destroy();
	}));
	it('asks before leaving or unloading only while unused invitations remain', () => {
		const component = TestBed.createComponent(FederationSetupComponent).componentInstance;
		expect(component.canDeactivate()).toBeTrue();
		component.invitations.set([{member_id: 2, invitation: 'secret', expires_at_unix: '1'}]);
		expect(component.canDeactivate()).toBeFalse();
	});
	it('announces an invitation expiring through a region that stays in place', fakeAsync(() => {
		const invitation = {member_id: 2, invitation: 'secret', expires_at_unix: String(DateTime.now().toUnixInteger() + 2)};
		setup.create.and.returnValue(of({setup_id: 'setup', member_id: 1, invitations: [invitation]}));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		fixture.componentInstance.create({members: 3, threshold: 2, network: 'regtest'});
		fixture.detectChanges();
		const region: HTMLElement = fixture.nativeElement.querySelector('.setup-expiry[role="status"]');
		expect(region.textContent).toContain('Expires in');
		fixture.componentInstance.now.set(DateTime.now().toUnixInteger() + 3);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.setup-expiry[role="status"]')).toBe(region);
		expect(region.textContent).toContain('Expired, replace it');
		fixture.destroy();
	}));
	it('updates the expiry clock only while the tab is visible', fakeAsync(() => {
		const hidden = Object.getOwnPropertyDescriptor(document, 'hidden')!.get as jasmine.Spy;
		hidden.and.returnValue(true);
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		fixture.componentInstance.now.set(0);
		tick(6000);
		expect(fixture.componentInstance.now()).toBe(0);
		hidden.and.returnValue(false);
		tick(3000);
		expect(fixture.componentInstance.now()).toBeGreaterThan(0);
		fixture.destroy();
	}));
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
	it('lets other authenticated roles read setup progress', fakeAsync(() => {
		load_user.and.returnValue(of({role: UserRole.Reader}));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(3000);
		expect(setup.getStatus).toHaveBeenCalled();
		fixture.destroy();
	}));
	it('shows the own fingerprint once, in the slot for the coordinator and in the aside for a joining member', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		fixture.detectChanges();
		const fingerprints = (): HTMLElement[] =>
			Array.from(fixture.nativeElement.querySelectorAll('[data-testid="identity-fingerprint"]'));
		expect(fingerprints().length).toBe(1);
		expect(fingerprints()[0].closest('[data-testid="member-slot"]')).not.toBeNull();
		fixture.componentInstance.status.set({...setupStatus(), role: 'SETUP_ROLE_PARTICIPANT', member_id: 2, enrolled_members: [1, 2]});
		fixture.detectChanges();
		expect(fingerprints().length).toBe(1);
		expect(fingerprints()[0].closest('[aria-labelledby="fingerprint-title"]')).not.toBeNull();
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
		fixture.detectChanges();
		expect(buttonTexts(fixture.nativeElement)).not.toContain('Abort setup');
		fixture.destroy();
	}));
	it('selects views from the new enum names and offers abort in the card actions only before key generation', fakeAsync(() => {
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		tick(0);
		const component = fixture.componentInstance;
		const element: HTMLElement = fixture.nativeElement;
		expect(component.view()).toBe('waiting');
		fixture.detectChanges();
		// Every step keeps its actions in the card on the right
		expect(buttonTexts(element.querySelector('aside')!)).toEqual(['Propose federation', 'Abort setup']);
		component.proposal.set(setupProposal());
		component.status.set({...setupStatus(), proposal_hash: 'hash'});
		expect(component.view()).toBe('review');
		fixture.detectChanges();
		expect(buttonTexts(element.querySelector('orc-federation-setup-review aside')!)).toContain('Abort setup');
		component.status.set({...setupStatus(), participant_phase: 'SETUP_PARTICIPANT_PHASE_DKG_RUNNING'});
		expect(component.view()).toBe('keygen');
		fixture.detectChanges();
		expect(buttonTexts(element)).not.toContain('Abort setup');
		component.status.set({...setupStatus(), coordinator_phase: 'SETUP_COORDINATOR_PHASE_ABORTED'});
		expect(component.view()).toBe('aborted');
		fixture.detectChanges();
		expect(buttonTexts(element)).toContain('Clear and start a new setup');
		fixture.destroy();
	}));
	it('locks the forms while busy or for roles that cannot change setup', () => {
		const component = TestBed.createComponent(FederationSetupComponent).componentInstance;
		component.is_admin.set(true);
		expect(component.locked()).toBeFalse();
		component.busy.set(true);
		expect(component.locked()).toBeTrue();
		component.busy.set(false);
		component.is_admin.set(false);
		expect(component.locked()).toBeTrue();
	});
	it('names the members Propose still waits for, and toggles an invitation open and closed', () => {
		const component = TestBed.createComponent(FederationSetupComponent).componentInstance;
		component.status.set({...setupStatus(), missing_enrollments: [3]});
		expect(component.propose_hint()).toBe('Opens once member 3 has joined');
		component.status.set({...setupStatus(), missing_enrollments: [2, 3]});
		expect(component.propose_hint()).toBe('Opens once members 2 and 3 have joined');
		component.toggleInvitation(3);
		expect(component.selected_member()).toBe(3);
		component.toggleInvitation(3);
		expect(component.selected_member()).toBeNull();
	});
});
