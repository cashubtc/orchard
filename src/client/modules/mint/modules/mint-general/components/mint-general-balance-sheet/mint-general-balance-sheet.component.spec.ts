/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
/* Local Dependencies */
import {MintGeneralBalanceSheetComponent} from './mint-general-balance-sheet.component';

/** Builds a mock MintKeyset with overridable fields. */
function buildKeyset(overrides: Partial<MintKeyset> = {}): MintKeyset {
	return {
		id: 'ks_001',
		active: true,
		derivation_path: "m/0'/0'/0'",
		derivation_path_index: 0,
		input_fee_ppk: 0,
		unit: 'sat',
		valid_from: null,
		valid_to: null,
		final_expiry: null,
		fees_paid: 0,
		amounts: [],
		...overrides,
	} as MintKeyset;
}

describe('MintGeneralBalanceSheetComponent', () => {
	let component: MintGeneralBalanceSheetComponent;
	let fixture: ComponentFixture<MintGeneralBalanceSheetComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintGeneralBalanceSheetComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('balances', []);
		fixture.componentRef.setInput('keysets', []);
		fixture.componentRef.setInput('lightning_balance', null);
		fixture.componentRef.setInput('lightning_enabled', false);
		fixture.componentRef.setInput('lightning_loading', false);
		fixture.componentRef.setInput('bitcoin_oracle_enabled', false);
		fixture.componentRef.setInput('bitcoin_oracle_price', null);
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('asset balances', () => {
		const lightning_balance = {open: {local_balance: 50000}} as any;

		it('should back a sat row with the lightning balance', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({unit: 'sat'})]);
			fixture.componentRef.setInput('lightning_balance', lightning_balance);
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();

			expect(component.rows()[0].assets).toBe(50000);
			expect(component.rows()[0].is_bitcoin).toBe(true);
		});

		it('should not back a custom unit row with the lightning balance', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({unit: 'ora'})]);
			fixture.componentRef.setInput('lightning_balance', lightning_balance);
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();

			expect(component.rows()[0].assets).toBeNull();
			expect(component.rows()[0].is_bitcoin).toBe(false);
		});

		it('should not back a fiat row with the lightning balance', () => {
			fixture.componentRef.setInput('keysets', [buildKeyset({unit: 'usd'})]);
			fixture.componentRef.setInput('lightning_balance', lightning_balance);
			fixture.componentRef.setInput('loading', false);
			fixture.detectChanges();

			expect(component.rows()[0].assets).toBeNull();
		});
	});
});
