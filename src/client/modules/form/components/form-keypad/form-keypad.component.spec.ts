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

	it('emits the key pressed, delete as backspace', () => {
		const key = jasmine.createSpy('key');
		component.key.subscribe(key);
		buttons()[9].click();
		buttons()[10].click();
		expect(key.calls.allArgs()).toEqual([['0'], ['backspace']]);
	});

	it('offers a decimal point only when asked', () => {
		expect(buttons().length).toBe(11);
		const key = jasmine.createSpy('key');
		component.key.subscribe(key);
		fixture.componentRef.setInput('decimal', true);
		fixture.detectChanges();

		expect(buttons().length).toBe(12);
		buttons()[9].click();
		expect(key).toHaveBeenCalledWith('.');
	});
});
