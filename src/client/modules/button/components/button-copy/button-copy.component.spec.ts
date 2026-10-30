/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcButtonModule} from '@client/modules/button/button.module';
/* Local Dependencies */
import {ButtonCopyComponent} from './button-copy.component';

describe('ButtonCopyComponent', () => {
	let component: ButtonCopyComponent;
	let fixture: ComponentFixture<ButtonCopyComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcButtonModule],
		}).compileComponents();

		fixture = TestBed.createComponent(ButtonCopyComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('text', 'test');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('copies from a real button in the pill variant, then shows the check', () => {
		const write = spyOn(navigator.clipboard, 'writeText').and.resolveTo();
		fixture.componentRef.setInput('size', 'pill');
		fixture.detectChanges();
		const pill: HTMLButtonElement = fixture.nativeElement.querySelector('button.button-copy-pill');
		pill.click();
		fixture.detectChanges();
		expect(write).toHaveBeenCalledWith('test');
		expect(pill.querySelector('mat-icon')?.textContent).toContain('check');
	});
});
