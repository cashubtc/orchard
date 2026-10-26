import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {FORM_PANEL_DATA, FormPanelRef} from '@client/modules/form/services/form-panel';
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {ServiceEditorComponent} from './service-editor.component';

describe('ServiceEditorComponent', () => {
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
				{provide: ServiceConfigService, useValue: {save}},
			],
		});
		const fixture = TestBed.createComponent(ServiceEditorComponent);
		fixture.componentInstance.submit(true);
		fixture.detectChanges();
		expect(fixture.componentInstance.saved()).toBeFalse();
		expect(fixture.nativeElement.textContent).toContain('Save without a working connection');
		fixture.componentInstance.submit(true, true);
		expect(fixture.componentInstance.saved()).toBeTrue();
		fixture.componentInstance.changed();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).not.toContain('Save without a working connection');
	});
});
