/* Core Dependencies */
import {Component, EnvironmentInjector, Injector, ViewContainerRef, WritableSignal, createEnvironmentInjector, signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {Subject} from 'rxjs';
import {MatBottomSheet} from '@angular/material/bottom-sheet';
/* Local Dependencies */
import {FormPanelService} from './form-panel.service';
import {FormPanelRef} from './form-panel-ref';
import {FORM_PANEL_DATA} from './form-panel.types';

@Component({selector: 'orc-test-panel', template: ''})
class TestPanelComponent {}

describe('FormPanelService', () => {
	let service: FormPanelService;
	let container: jasmine.SpyObj<ViewContainerRef>;
	let bottom_sheet: jasmine.SpyObj<MatBottomSheet>;
	let sheet_dismissed: Subject<void>;
	let sheet_ref: {afterDismissed: () => Subject<void>; dismiss: jasmine.Spy};
	let sheet: WritableSignal<boolean>;

	beforeEach(() => {
		sheet = signal<boolean>(false);
		sheet_dismissed = new Subject<void>();
		sheet_ref = {afterDismissed: () => sheet_dismissed, dismiss: jasmine.createSpy('dismiss')};
		bottom_sheet = jasmine.createSpyObj('MatBottomSheet', ['open']);
		bottom_sheet.open.and.returnValue(sheet_ref as any);
		TestBed.configureTestingModule({
			providers: [{provide: MatBottomSheet, useValue: bottom_sheet}],
		});
		service = TestBed.inject(FormPanelService);
		container = jasmine.createSpyObj('ViewContainerRef', ['clear', 'createComponent'], {injector: TestBed.inject(Injector)});
		service.registerContainer(container, {sheet});
	});

	it('opens panels in the section sidenav while the host wants no sheet', () => {
		const opened = jasmine.createSpy('opened');
		service.afterOpened().subscribe(opened);
		service.open(TestPanelComponent, {data: {amount: 21}});
		expect(container.createComponent).toHaveBeenCalled();
		expect(opened).toHaveBeenCalled();
		expect(bottom_sheet.open).not.toHaveBeenCalled();
	});

	it('opens in a bottom sheet while the host wants one, with the same data and ref', () => {
		sheet.set(true);
		const opened = jasmine.createSpy('opened');
		service.afterOpened().subscribe(opened);
		const ref = service.open(TestPanelComponent, {data: {amount: 21}});
		const {injector} = bottom_sheet.open.calls.mostRecent().args[1]!;
		expect(injector!.get(FORM_PANEL_DATA)).toEqual({amount: 21});
		expect(injector!.get(FormPanelRef)).toBe(ref);
		expect(container.createComponent).not.toHaveBeenCalled();
		expect(opened).not.toHaveBeenCalled();
		expect(service.opened()).toBeTrue();
	});

	it('dismisses the sheet when the panel closes, and closes the panel when the sheet is dismissed', () => {
		sheet.set(true);
		service.open(TestPanelComponent).close('done');
		expect(sheet_ref.dismiss).toHaveBeenCalled();
		expect(service.opened()).toBeFalse();

		const closed = jasmine.createSpy('closed');
		service.open(TestPanelComponent).afterClosed().subscribe(closed);
		sheet_dismissed.next();
		expect(closed).toHaveBeenCalledWith(undefined);
		expect(service.opened()).toBeFalse();
	});

	it('forgets the host once it is destroyed', () => {
		const host_injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
		service.registerContainer(jasmine.createSpyObj('ViewContainerRef', ['clear'], {injector: host_injector}), {sheet});
		host_injector.destroy();
		expect(() => service.open(TestPanelComponent)).toThrowError(/No container registered/);
	});

	it('always uses the sidenav for hosts registered without options', () => {
		sheet.set(true);
		service.registerContainer(container);
		service.open(TestPanelComponent, {data: {}});
		expect(container.createComponent).toHaveBeenCalled();
		expect(bottom_sheet.open).not.toHaveBeenCalled();
	});
});
