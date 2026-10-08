/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
/* Local Dependencies */
import {FormKeypadComponent} from './form-keypad.component';

describe('FormKeypadComponent', () => {
	let component: FormKeypadComponent;
	let fixture: ComponentFixture<FormKeypadComponent>;

	const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcFormModule],
		}).compileComponents();

		fixture = TestBed.createComponent(FormKeypadComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('emits the digit pressed', () => {
		const digit = jasmine.createSpy('digit');
		component.digit.subscribe(digit);
		buttons()[9].click();
		expect(digit).toHaveBeenCalledWith('0');
	});

	it('emits backspace from the delete key', () => {
		const backspace = jasmine.createSpy('backspace');
		component.backspace.subscribe(backspace);
		buttons()[10].click();
		expect(backspace).toHaveBeenCalled();
	});
});
