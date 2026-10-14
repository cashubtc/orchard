/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralBalanceAmountComponent} from './ecash-general-balance-amount.component';

describe('EcashGeneralBalanceAmountComponent', () => {
	let component: EcashGeneralBalanceAmountComponent;
	let fixture: ComponentFixture<EcashGeneralBalanceAmountComponent>;

	const shown = (): string => component.cells().reduce((text, cell) => text + cell.char, '');
	const show = (unit: string, amount: number): void => {
		fixture.componentRef.setInput('unit', unit);
		fixture.componentRef.setInput('amount', amount);
		fixture.detectChanges();
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralBalanceAmountComponent);
		component = fixture.componentInstance;
	});

	it('draws the first amount as it is, labelled in full', () => {
		show('sat', 2100);
		expect(shown()).toBe('2,100');
		expect(fixture.nativeElement.getAttribute('aria-label')).toBe('₿ 2,100');
	});

	it('counts a new amount in the same unit from the value on screen, holding the wider width', () => {
		show('usd', 450);
		show('usd', 120000);
		expect(shown()).toBe('4.50');
		expect(component.label()).toBe('$ 1,200.00');
		expect(component.width()).toBeGreaterThan(component.cells().reduce((width, cell) => width + cell.width, 0));
	});

	it('jumps to the amount of a new unit', () => {
		show('sat', 2100);
		show('usd', 450);
		expect(shown()).toBe('4.50');
	});
});
