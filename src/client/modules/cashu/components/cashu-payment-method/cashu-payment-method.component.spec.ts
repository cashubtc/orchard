/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcCashuModule} from '@client/modules/cashu/cashu.module';
/* Local Dependencies */
import {CashuPaymentMethodComponent} from './cashu-payment-method.component';

describe('CashuPaymentMethodComponent', () => {
	let component: CashuPaymentMethodComponent;
	let fixture: ComponentFixture<CashuPaymentMethodComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcCashuModule, MatIconTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(CashuPaymentMethodComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('payment_method', 'bolt11');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
		expect(fixture.nativeElement.textContent).toContain('BOLT 11');
	});

	it('names a method Orchard does not know in capitals, with the custom method icon', () => {
		fixture.componentRef.setInput('payment_method', 'branch');
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('BRANCH');
		expect(fixture.nativeElement.querySelector('mat-icon').textContent.trim()).toBe('money_bag');
	});
});
