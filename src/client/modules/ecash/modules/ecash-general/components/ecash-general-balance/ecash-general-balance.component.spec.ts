/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
/* Local Dependencies */
import {EcashGeneralBalanceComponent} from './ecash-general-balance.component';

describe('EcashGeneralBalanceComponent', () => {
	let component: EcashGeneralBalanceComponent;
	let fixture: ComponentFixture<EcashGeneralBalanceComponent>;

	const balance = (mint_id: string, unit: string, amount: number) => new EcashBalance({mint_id, unit, balance: amount});

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralBalanceComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('balances', []);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('shows a unitless 0 when the wallet holds nothing', () => {
		expect(fixture.nativeElement.querySelector('.ecash-balance-empty')?.textContent.trim()).toBe('0');
	});

	it('sums each unit across mints, bitcoin units first', () => {
		fixture.componentRef.setInput('balances', [
			balance('mint-1', 'usd', 450),
			balance('mint-1', 'sat', 1000),
			balance('mint-2', 'sat', 500),
		]);
		expect(component.rows().map(({unit, balance, mints}) => ({unit, balance, mints}))).toEqual([
			{unit: 'sat', balance: 1500, mints: 2},
			{unit: 'usd', balance: 450, mints: 1},
		]);
	});

	it('converts bitcoin units to USD only when the oracle is enabled', () => {
		fixture.componentRef.setInput('balances', [balance('mint-1', 'sat', 100_000), balance('mint-1', 'usd', 450)]);
		fixture.componentRef.setInput('bitcoin_oracle_price', new BitcoinOraclePrice({date: 0, price: 100_000}));
		expect(component.rows().map((row) => row.balance_oracle)).toEqual([null, null]);

		fixture.componentRef.setInput('bitcoin_oracle_enabled', true);
		expect(component.rows().map((row) => row.balance_oracle)).toEqual([10_000, null]);
	});
});
