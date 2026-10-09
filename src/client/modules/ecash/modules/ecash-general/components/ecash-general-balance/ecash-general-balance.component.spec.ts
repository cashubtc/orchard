/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
/* Local Dependencies */
import {EcashGeneralBalanceComponent} from './ecash-general-balance.component';

describe('EcashGeneralBalanceComponent', () => {
	let component: EcashGeneralBalanceComponent;
	let fixture: ComponentFixture<EcashGeneralBalanceComponent>;

	const balance = (mint_id: string, unit: string, amount: number) => new EcashBalance({mint_id, unit, balance: amount});
	const mint = (id: string, name: string, units: string[]) =>
		new EcashMint({
			id,
			urls: [`https://${id}.example`],
			is_orchard: false,
			created_at: 0,
			info: {
				name,
				nuts: {
					nut4: {disabled: false, methods: units.map((unit) => ({method: 'bolt11', unit}))},
					nut5: {disabled: false, methods: []},
				},
			},
		});

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

	it('offers sat alone, with no balance, when the wallet has no mints', () => {
		expect(component.chips()).toEqual([{unit: 'sat', amount: 0}]);
		expect(component.selection()).toEqual(jasmine.objectContaining({unit: 'sat', amount: 0, caption: 'No balance on any mint'}));
		expect(fixture.nativeElement.textContent).toContain('No balance on any mint');
	});

	it("offers every unit the wallet's mints offer, zero balances included, summed across mints and bitcoin first", () => {
		fixture.componentRef.setInput('mints', [mint('mint-1', 'Cedar', ['usd', 'sat']), mint('mint-2', 'Elm', ['sat', 'eur'])]);
		fixture.componentRef.setInput('balances', [balance('mint-1', 'sat', 1000), balance('mint-2', 'sat', 500)]);
		expect(component.chips()).toEqual([
			{unit: 'sat', amount: 1500},
			{unit: 'eur', amount: 0},
			{unit: 'usd', amount: 0},
		]);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Across 2 mints');
	});

	it('shows the picked chip, naming the one mint that holds it', () => {
		fixture.componentRef.setInput('mints', [mint('mint-1', 'Cedar', ['sat', 'usd'])]);
		fixture.componentRef.setInput('balances', [balance('mint-1', 'usd', 450)]);
		fixture.detectChanges();
		fixture.nativeElement.querySelectorAll('.ecash-unit-chip')[1].click();
		fixture.detectChanges();

		expect(component.selection()).toEqual(jasmine.objectContaining({unit: 'usd', amount: 450, caption: 'Cedar'}));
		expect(fixture.nativeElement.textContent).toContain('Cedar');
	});

	it('falls back to the first chip once the picked unit is no longer offered', () => {
		fixture.componentRef.setInput('mints', [mint('mint-1', 'Cedar', ['sat', 'usd'])]);
		component.onSelect('usd');
		fixture.componentRef.setInput('mints', [mint('mint-1', 'Cedar', ['sat'])]);
		expect(component.selection().unit).toBe('sat');
	});

	it('converts sat to USD only when the oracle is enabled', () => {
		fixture.componentRef.setInput('balances', [balance('mint-1', 'sat', 100_000)]);
		fixture.componentRef.setInput('bitcoin_oracle_price', new BitcoinOraclePrice({date: 0, price: 100_000}));
		expect(component.selection().amount_oracle).toBeNull();

		fixture.componentRef.setInput('bitcoin_oracle_enabled', true);
		expect(component.selection().amount_oracle).toBe(10_000);
	});
});
