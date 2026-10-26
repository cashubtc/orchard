/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
/* Local Dependencies */
import {FormToggleGroupComponent} from './form-toggle-group.component';

describe('FormToggleGroupComponent', () => {
	let component: FormToggleGroupComponent;
	let fixture: ComponentFixture<FormToggleGroupComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcFormModule],
		}).compileComponents();

		fixture = TestBed.createComponent(FormToggleGroupComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('marks its host when set to the small size', () => {
		expect(fixture.nativeElement.classList).not.toContain('small');
		fixture.componentRef.setInput('size', 'small');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList).toContain('small');
	});
});
