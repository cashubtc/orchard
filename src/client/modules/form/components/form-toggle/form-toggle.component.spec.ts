/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
/* Local Dependencies */
import {FormToggleComponent} from './form-toggle.component';

describe('FormToggleComponent', () => {
	let component: FormToggleComponent;
	let fixture: ComponentFixture<FormToggleComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcFormModule],
		}).compileComponents();

		fixture = TestBed.createComponent(FormToggleComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('exposes the selected state as aria-pressed on its button', () => {
		const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
		expect(button.getAttribute('aria-pressed')).toBe('false');
		fixture.componentRef.setInput('selected', true);
		fixture.detectChanges();
		expect(button.getAttribute('aria-pressed')).toBe('true');
	});
});
