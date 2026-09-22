/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
/* Vendor Dependencies */
import {of, throwError} from 'rxjs';
/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {AuthService} from '@client/modules/auth/services/auth/auth.service';
import {OrcAuthSubsectionSignupModule} from '@client/modules/auth/modules/auth-subsection-signup/auth-subsection-signup.module';
/* Local Dependencies */
import {AuthSubsectionSignupComponent} from './auth-subsection-signup.component';

describe('AuthSubsectionSignupComponent', () => {
	let component: AuthSubsectionSignupComponent;
	let fixture: ComponentFixture<AuthSubsectionSignupComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcAuthSubsectionSignupModule],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: {
						params: of({}),
						queryParams: of({}),
						snapshot: {params: {}, queryParams: {}},
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(AuthSubsectionSignupComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('preserves multiple server error codes for field-specific signup validation', () => {
		const errors = new OrchardErrors([
			{message: 'Invalid invite', extensions: {code: 80003}},
			{message: 'Duplicate username', extensions: {code: 10007}},
		]);
		const signup = spyOn(TestBed.inject(AuthService), 'signup').and.returnValue(throwError(() => errors));
		component.form_signup.setValue({key: 'invalid-invite', name: 'admin', password: 'tester', password_confirm: 'tester'});
		component.onSubmit();
		expect(signup).toHaveBeenCalledWith('invalid-invite', 'admin', 'tester');
		expect(component.errors.key).toBe('Invalid invite key');
		expect(component.errors.name).toBe('Username already exists');
		expect(component.form_signup.get('key')?.invalid).toBeTrue();
		expect(component.form_signup.get('name')?.invalid).toBeTrue();
	});
});
