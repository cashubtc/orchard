/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Vendor Dependencies */
import {throwError} from 'rxjs';
/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {AuthService} from '@client/modules/auth/services/auth/auth.service';
import {OrcAuthSubsectionAuthenticationModule} from '@client/modules/auth/modules/auth-subsection-authentication/auth-subsection-authentication.module';
/* Local Dependencies */
import {AuthSubsectionAuthenticationComponent} from './auth-subsection-authentication.component';

describe('AuthSubsectionAuthenticationComponent', () => {
	let component: AuthSubsectionAuthenticationComponent;
	let fixture: ComponentFixture<AuthSubsectionAuthenticationComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcAuthSubsectionAuthenticationModule],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(AuthSubsectionAuthenticationComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	for (const scenario of [
		{code: 10002, expected: 'Incorrect username or password'},
		{code: 10005, expected: 'Too many attempts, please try again later'},
	]) {
		it(`still routes error ${scenario.code} to the password field`, () => {
			const errors = new OrchardErrors([{message: 'Authentication failed', extensions: {code: scenario.code}}]);
			const authenticate = spyOn(TestBed.inject(AuthService), 'authenticate').and.returnValue(throwError(() => errors));
			component.form_auth.setValue({name: 'admin', password: 'tester'});
			component.onSubmit();
			expect(authenticate).toHaveBeenCalledWith('admin', 'tester');
			expect(component.form_auth.get('password')?.invalid).toBeTrue();
			expect(component.errors.password).toBe(scenario.expected);
		});
	}
});
