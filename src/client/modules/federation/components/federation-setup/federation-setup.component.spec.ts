/* Core Dependencies */
import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
/* Vendor Dependencies */
import {of, Subject, throwError} from 'rxjs';
/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
import {FederationSetupComponent} from './federation-setup.component';
/* Shared Dependencies */
import type {OrchardFederationMode} from '@shared/generated.types';

describe('FederationSetupComponent', () => {
	const mode = signal<string | null>('setup');
	const details = signal<string | null>(null);
	let load_mode: jasmine.Spy;
	let navigate: jasmine.Spy;
	beforeEach(async () => {
		mode.set('setup');
		details.set(null);
		load_mode = jasmine.createSpy().and.returnValue(of({mode: 'setup', details: null}));
		navigate = jasmine.createSpy().and.resolveTo(true);
		await TestBed.configureTestingModule({
			imports: [FederationSetupComponent],
			providers: [
				{provide: FederationService, useValue: {mode, details, loadMode: load_mode}},
				{provide: Router, useValue: {navigate}},
			],
		}).compileComponents();
	});
	it('renders the setup mode the guard found without probing again', () => {
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('setup');
		expect(load_mode).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});
	it('probes when opened directly', () => {
		mode.set(null);
		TestBed.createComponent(FederationSetupComponent).detectChanges();
		expect(load_mode).toHaveBeenCalledWith(true);
	});
	it('returns to the mint after activation', () => {
		load_mode.and.returnValue(of({mode: 'member', details: null}));
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		fixture.componentInstance.refresh();
		expect(navigate).toHaveBeenCalledWith(['/mint']);
	});
	it('shows the original diagnostic on a failed refresh', () => {
		mode.set(null);
		load_mode.and.returnValue(
			throwError(() => new OrchardErrors([{message: 'Busy', extensions: {code: 40016, details: 'Too many status calls'}}])),
		);
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Too many status calls');
		expect(fixture.componentInstance.loading()).toBeFalse();
	});
	it('coalesces refresh clicks and cancels the pending request when destroyed', () => {
		mode.set(null);
		const pending = new Subject<OrchardFederationMode>();
		load_mode.and.returnValue(pending);
		const fixture = TestBed.createComponent(FederationSetupComponent);
		fixture.detectChanges();
		fixture.componentInstance.refresh();
		expect(load_mode).toHaveBeenCalledTimes(1);
		fixture.destroy();
		expect(pending.observed).toBeFalse();
	});
});
