/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralUnitChipsComponent} from './ecash-general-unit-chips.component';

describe('EcashGeneralUnitChipsComponent', () => {
	let component: EcashGeneralUnitChipsComponent;
	let fixture: ComponentFixture<EcashGeneralUnitChipsComponent>;

	const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralUnitChipsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('chips', [
			{unit: 'sat', amount: 601},
			{unit: 'usd', amount: 0},
		]);
		fixture.componentRef.setInput('selected', 'sat');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('shows each balance, zero included, and marks the selected chip', () => {
		expect(buttons()[0].textContent).toContain('601');
		expect(buttons()[1].textContent).toContain('0.00');
		expect(buttons().map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
	});

	it('shows unit labels instead of balances when asked', () => {
		fixture.componentRef.setInput('show_unit', true);
		fixture.detectChanges();
		expect(buttons()[1].textContent).toContain('USD');
		expect(buttons()[1].textContent).not.toContain('0.00');
	});

	it('emits the unit picked', () => {
		const select = jasmine.createSpy('select');
		component.select.subscribe(select);
		buttons()[1].click();
		expect(select).toHaveBeenCalledWith('usd');
	});
});
