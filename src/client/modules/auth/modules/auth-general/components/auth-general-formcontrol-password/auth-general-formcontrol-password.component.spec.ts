/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup, Validators} from '@angular/forms';
/* Native Dependencies */
import {OrcAuthGeneralModule} from '@client/modules/auth/modules/auth-general/auth-general.module';
/* Local Dependencies */
import {AuthGeneralFormcontrolPasswordComponent} from './auth-general-formcontrol-password.component';

describe('AuthGeneralFormcontrolPasswordComponent', () => {
	let component: AuthGeneralFormcontrolPasswordComponent;
	let fixture: ComponentFixture<AuthGeneralFormcontrolPasswordComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcAuthGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(AuthGeneralFormcontrolPasswordComponent);
		component = fixture.componentInstance;

		const form_group = new FormGroup({
			password: new FormControl('', {validators: [Validators.required]}),
		});

		fixture.componentRef.setInput('form_group', form_group);
		fixture.componentRef.setInput('control_name', 'password');
		fixture.componentRef.setInput('label', 'Password');
		fixture.componentRef.setInput('focused_control', false);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('marks the input as the first focus only while asked to focus it', () => {
		const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
		expect(input.hasAttribute('cdkFocusInitial')).toBeFalse();
		fixture.componentRef.setInput('focused_control', true);
		fixture.detectChanges();
		expect(input.hasAttribute('cdkFocusInitial')).toBeTrue();
	});
});
