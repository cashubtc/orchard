import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {bitcoinConfiguration} from '@client/modules/service-config/helpers/service-config.fixture';
import {ServiceKind} from '@shared/generated.types';
import {ServiceRemoveDialogComponent} from './service-remove-dialog.component';

describe('ServiceRemoveDialogComponent', () => {
	it('names the saved endpoint, preserves mint independence, and offers Cancel', () => {
		const configuration = {...bitcoinConfiguration(), service: ServiceKind.Lightning};
		const close = jasmine.createSpy();
		TestBed.configureTestingModule({
			providers: [
				{provide: MAT_DIALOG_DATA, useValue: configuration},
				{provide: MatDialogRef, useValue: {close}},
			],
		});
		const fixture = TestBed.createComponent(ServiceRemoveDialogComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('localhost:8332');
		expect(fixture.nativeElement.textContent).toContain("Your mint isn't affected");
		expect(fixture.nativeElement.textContent).toContain('LIGHTNING_*');
		const cancel = fixture.nativeElement.querySelector('button');
		expect(cancel.textContent.trim()).toBe('Cancel');
		cancel.click();
		expect(close).toHaveBeenCalledWith(false);
	});
});
