/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcSettingsSubsectionUserModule} from '@client/modules/settings/modules/settings-subsection-user/settings-subsection-user.module';
/* Local Dependencies */
import {SettingsSubsectionUserUserPasswordComponent} from './settings-subsection-user-user-password.component';

describe('SettingsSubsectionUserUserPasswordComponent', () => {
	let component: SettingsSubsectionUserUserPasswordComponent;
	let fixture: ComponentFixture<SettingsSubsectionUserUserPasswordComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcSettingsSubsectionUserModule],
		}).compileComponents();

		fixture = TestBed.createComponent(SettingsSubsectionUserUserPasswordComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('stretches the button to full width on a phone', () => {
		const button = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');
		expect(button().classList).not.toContain('w-full');
		fixture.componentRef.setInput('device_type', 'mobile');
		fixture.detectChanges();
		expect(button().classList).toContain('w-full');
	});
});
