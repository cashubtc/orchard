/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
/* Native Dependencies */
import {OrcSettingsSubsectionUserModule} from '@client/modules/settings/modules/settings-subsection-user/settings-subsection-user.module';
/* Local Dependencies */
import {SettingsSubsectionUserUserPasswordDialogComponent} from './settings-subsection-user-user-password-dialog.component';

describe('SettingsSubsectionUserUserPasswordDialogComponent', () => {
	let component: SettingsSubsectionUserUserPasswordDialogComponent;
	let fixture: ComponentFixture<SettingsSubsectionUserUserPasswordDialogComponent>;

	beforeEach(async () => {
		const mock_dialog_ref = {
			close: jasmine.createSpy('close'),
		};

		await TestBed.configureTestingModule({
			imports: [OrcSettingsSubsectionUserModule],
			providers: [
				{provide: MatDialogRef, useValue: mock_dialog_ref},
				{provide: MAT_DIALOG_DATA, useValue: {device_mobile: false}},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(SettingsSubsectionUserUserPasswordDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('offers the saved password for the current password only', () => {
		const inputs: HTMLInputElement[] = Array.from(fixture.nativeElement.querySelectorAll('input'));
		expect(inputs.map((input) => input.getAttribute('autocomplete'))).toEqual(['current-password', 'new-password', 'new-password']);
	});
});
