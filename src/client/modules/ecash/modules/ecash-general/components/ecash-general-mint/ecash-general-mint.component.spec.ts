/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
/* Local Dependencies */
import {EcashGeneralMintComponent} from './ecash-general-mint.component';

describe('EcashGeneralMintComponent', () => {
	let component: EcashGeneralMintComponent;
	let fixture: ComponentFixture<EcashGeneralMintComponent>;

	const mint = new EcashMint({
		id: 'mint-1',
		urls: ['https://mint.orchard.example'],
		is_orchard: true,
		created_at: 0,
		info: {
			name: 'e2e-nutshell',
			nuts: {
				nut4: {disabled: false, methods: ['usd', 'sat'].map((unit) => ({method: 'bolt11', unit}))},
				nut5: {disabled: false, methods: []},
			},
		},
	});
	const reserves = new MintReserves({liabilities: [{unit: 'sat', amount: 3606}], sources: [], reserves: 10_005_068, partial: false});

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('mint', mint);
		fixture.componentRef.setInput('balances', [new EcashBalance({mint_id: 'mint-1', unit: 'sat', balance: 601})]);
		fixture.componentRef.setInput('status', {state: 'active', text: 'Online · 7 ms', error: null});
		fixture.componentRef.setInput('reserves', reserves);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it("shows every unit the mint offers with the wallet's balance there, bitcoin first", () => {
		expect(component.chips()).toEqual([
			{unit: 'sat', amount: 601},
			{unit: 'usd', amount: 0},
		]);
	});

	it('shows the balance sheet in the bitcoin unit', () => {
		expect(component.solvency()).toEqual({reserves, unit: 'sat', wallet_amount: 601});
		expect(fixture.nativeElement.querySelector('orc-ecash-general-solvency')).not.toBeNull();
	});

	it('shows no balance sheet without reserves', () => {
		fixture.componentRef.setInput('reserves', null);
		expect(component.solvency()).toBeNull();
	});
});
