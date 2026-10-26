import {signal} from '@angular/core';
import {TestBed, type ComponentFixture} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {of} from 'rxjs';
import {FORM_PANEL_DATA, FormPanelRef} from '@client/modules/form/services/form-panel';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {ServiceEditorComponent} from './service-editor.component';

describe('ServiceEditorComponent', () => {
	/** Click the button with exactly this label. */
	function click(fixture: ComponentFixture<ServiceEditorComponent>, label: string): void {
		Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
			.find((button) => button.textContent?.trim() === label)!
			.click();
		fixture.detectChanges();
	}

	/** Type into the field with this label. */
	function type(fixture: ComponentFixture<ServiceEditorComponent>, label: string, value: string): void {
		const field = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('mat-form-field')).find(
			(element) => element.querySelector('mat-label')?.textContent?.trim() === label,
		)!;
		const input: HTMLInputElement = field.querySelector('input')!;
		input.value = value;
		input.dispatchEvent(new Event('input'));
		fixture.detectChanges();
	}

	it('keeps failed saves open, offers the bypass, and invalidates it after editing', () => {
		const failure = {
			ok: false,
			warning: false,
			saved: false,
			title: 'Failed',
			context: 'localhost:8332',
			diagnostic: 'ECONNREFUSED',
			fields: ['host', 'port'],
		};
		const save = jasmine
			.createSpy()
			.and.callFake((_input: unknown, save_unreachable: boolean) => of({...failure, saved: save_unreachable}));
		TestBed.configureTestingModule({
			providers: [
				{provide: FORM_PANEL_DATA, useValue: bitcoinConfiguration()},
				{provide: FormPanelRef, useValue: {close: jasmine.createSpy()}},
				{provide: ServiceConfigService, useValue: {save, refresh_errors: signal({})}},
			],
		});
		const fixture = TestBed.createComponent(ServiceEditorComponent);
		fixture.detectChanges();
		click(fixture, 'Save connection');
		expect(fixture.componentInstance.saved()).toBeFalse();
		expect(fixture.nativeElement.textContent).toContain('Save without a working connection');
		type(fixture, 'RPC port', '18443');
		expect(fixture.nativeElement.textContent).not.toContain('Save without a working connection');
		click(fixture, 'Save connection');
		click(fixture, 'Save without a working connection');
		expect(fixture.componentInstance.saved()).toBeTrue();
		expect(fixture.nativeElement.textContent.match(/Connection saved/g)?.length).toBe(1);
		const applied = fixture.componentInstance.effective_configuration();
		expect(applied.fields.find((field) => field.key === 'port')?.value).toBe('18443');
		expect(applied.fields.find((field) => field.key === 'password')?.value).toBeNull();
	});

	it('confirms a removal and offers the status retry when the refresh after it fails', () => {
		const remove = jasmine.createSpy().and.returnValue(of(undefined));
		TestBed.configureTestingModule({
			providers: [
				{provide: FORM_PANEL_DATA, useValue: bitcoinConfiguration()},
				{provide: FormPanelRef, useValue: {close: jasmine.createSpy()}},
				{provide: ServiceConfigService, useValue: {remove, refresh_errors: signal({bitcoin: 'Refreshing status failed.'})}},
			],
		});
		// The form module brings its own MatDialog into the editor's injector
		TestBed.overrideComponent(ServiceEditorComponent, {
			add: {providers: [{provide: MatDialog, useValue: {open: () => ({afterClosed: () => of(true)})}}]},
		});
		const fixture = TestBed.createComponent(ServiceEditorComponent);
		fixture.detectChanges();
		click(fixture, 'Remove Bitcoin');
		expect(remove).toHaveBeenCalled();
		const statuses: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="status"]'));
		expect(statuses.map((status) => status.textContent?.trim())).toEqual(['Bitcoin removed. No restart needed.']);
		expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Retry status refresh');
	});
});
