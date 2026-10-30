/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {provideRouter} from '@angular/router';
/* Native Dependencies */
import {OrcAuthSubsectionAuthenticationModule} from '@client/modules/auth/modules/auth-subsection-authentication/auth-subsection-authentication.module';
/* Local Dependencies */
import {AuthSubsectionAuthenticationFormComponent} from './auth-subsection-authentication-form.component';

describe('AuthSubsectionAuthenticationFormComponent', () => {
	let component: AuthSubsectionAuthenticationFormComponent;
	let fixture: ComponentFixture<AuthSubsectionAuthenticationFormComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcAuthSubsectionAuthenticationModule],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(AuthSubsectionAuthenticationFormComponent);
		component = fixture.componentInstance;

		const form_group = new FormGroup({
			name: new FormControl('', {validators: [Validators.required]}),
			password: new FormControl('', {validators: [Validators.required]}),
		});
		const errors = {name: null, password: null};

		fixture.componentRef.setInput('form_group', form_group);
		fixture.componentRef.setInput('errors', errors);
		fixture.componentRef.setInput('device_mobile', false);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('lets a password manager fill the saved password', () => {
		expect(fixture.nativeElement.querySelector('input[type="password"]').getAttribute('autocomplete')).toBe('current-password');
	});
});
