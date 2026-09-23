/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
/* Local Dependencies */
import {FormErrorComponent} from './form-error.component';

describe('FormErrorComponent', () => {
	let component: FormErrorComponent;
	let fixture: ComponentFixture<FormErrorComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcFormModule],
		}).compileComponents();

		fixture = TestBed.createComponent(FormErrorComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('errors', null);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should describe a zero-decimal precision error as a whole number', () => {
		fixture.componentRef.setInput('errors', {orchardDecimals: {decimals: 0}});
		expect(component.known_error()).toBe('Must be a whole number');
	});

	it('should describe a fractional precision error by its decimal places', () => {
		fixture.componentRef.setInput('errors', {orchardDecimals: {decimals: 2}});
		expect(component.known_error()).toBe('Must have 2 decimals');
	});
});
