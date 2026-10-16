/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcCashuModule} from '@client/modules/cashu/cashu.module';
/* Local Dependencies */
import {CashuMethodChipsComponent} from './cashu-method-chips.component';

describe('CashuMethodChipsComponent', () => {
	let component: CashuMethodChipsComponent;
	let fixture: ComponentFixture<CashuMethodChipsComponent>;

	const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcCashuModule],
		}).compileComponents();

		fixture = TestBed.createComponent(CashuMethodChipsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('methods', ['bolt11', 'bolt12', 'branch']);
		fixture.componentRef.setInput('selected', 'bolt11');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('labels each method uppercase, custom ones included, and marks the selected chip', () => {
		expect(buttons().map((button) => button.textContent)).toEqual([
			jasmine.stringContaining('BOLT 11'),
			jasmine.stringContaining('BOLT 12'),
			jasmine.stringContaining('BRANCH'),
		]);
		expect(buttons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
	});

	it('shows display-only chips without buttons', () => {
		fixture.componentRef.setInput('selectable', false);
		fixture.detectChanges();
		expect(buttons().length).toBe(0);
		expect(fixture.nativeElement.querySelectorAll('.cashu-method-chip').length).toBe(3);
	});

	it('emits the method picked, unless disabled', () => {
		const select = jasmine.createSpy('select');
		component.select.subscribe(select);
		buttons()[1].click();
		expect(select).toHaveBeenCalledWith('bolt12');
		fixture.componentRef.setInput('disabled', true);
		fixture.detectChanges();
		expect(buttons().every((button) => button.disabled)).toBeTrue();
	});
});
