/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';

/* Application Dependencies */
import {ButtonCopyComponent} from '@client/modules/button/components/button-copy/button-copy.component';

/* Native Dependencies */
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {OrcMintSubsectionDatabaseModule} from '@client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module';
import {MintSubsectionDatabaseTableMeltComponent} from './mint-subsection-database-table-melt.component';

/* Shared Dependencies */
import {MeltQuoteState} from '@shared/generated.types';

describe('MintSubsectionDatabaseTableMeltComponent', () => {
	let component: MintSubsectionDatabaseTableMeltComponent;
	let fixture: ComponentFixture<MintSubsectionDatabaseTableMeltComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionDatabaseModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionDatabaseTableMeltComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('loading', false);
		fixture.componentRef.setInput('bitcoin_oracle_data', null);
		fixture.componentRef.setInput('device_desktop', true);
	});

	for (const {payment_method, unit, request, label} of [
		{payment_method: 'bolt11', unit: 'sat', request: 'lnbc1invoice', label: 'Bolt 11 Invoice'},
		{payment_method: 'bolt12', unit: 'sat', request: 'lno1offer', label: 'Bolt 12 Offer'},
		{payment_method: 'onchain', unit: 'sat', request: 'bcrt1qk6j0nzv6p2dy84ff6h0ukwv0309xct2huplpu5', label: 'Onchain Address'},
		{payment_method: 'onchain', unit: 'ora', request: 'bcrt1qk6j0nzv6p2dy84ff6h0ukwv0309xct2huplpu5', label: 'Onchain Address'},
		{payment_method: 'custom', unit: 'ora', request: 'custom-payment-request', label: 'Payment Request'},
	]) {
		it(`renders the ${payment_method} ${unit} request with the correct label, copy value and QR payload`, () => {
			const quote = new MintMeltQuote({
				id: 'quote-id',
				amount: 500,
				fee_reserve: 0,
				unit,
				payment_method,
				request,
				state: MeltQuoteState.Paid,
				created_time: 1_750_000_000,
			});
			fixture.componentRef.setInput('quote', quote);
			fixture.detectChanges();

			const element: HTMLElement = fixture.nativeElement;
			const labels = Array.from(element.querySelectorAll('.font-weight-extra-light'), (element) => element.textContent?.trim());
			expect(labels).toContain(label);
			if (payment_method === 'onchain' || payment_method === 'custom') {
				expect(labels).not.toContain('Bolt 11 Invoice');
				expect(labels).not.toContain('Bolt 12 Offer');
			}
			const copy_buttons: ButtonCopyComponent[] = fixture.debugElement
				.queryAll(By.directive(ButtonCopyComponent))
				.map((element) => element.componentInstance as ButtonCopyComponent);
			expect(copy_buttons.map((button) => button.text())).toContain(request);
			expect(element.querySelector('.w-max-36 .mega-string')?.textContent?.trim()).toBe(request);
			expect(component.qr_code._options.data).toBe(request);
		});
	}
});
