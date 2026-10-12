/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralSolvencyComponent} from './ecash-general-solvency.component';

describe('EcashGeneralSolvencyComponent', () => {
	let component: EcashGeneralSolvencyComponent;
	let fixture: ComponentFixture<EcashGeneralSolvencyComponent>;

	const reserves = (reserves_sats: number | null, liabilities: number) =>
		new MintReserves({liabilities: [{unit: 'sat', amount: liabilities}], sources: [], reserves: reserves_sats, partial: false});

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralSolvencyComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('reserves', reserves(10_005_068, 3606));
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('wallet_amount', 601);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it("weighs the mint's reserves against the unit's liabilities", () => {
		expect(component.verdict()).toBe('backed');
		expect(component.coverage()).toBe(2775);
		expect(component.liabilities_sats()).toBe(3606);
		expect(fixture.nativeElement.textContent).toContain('Fully backed');
		expect(fixture.nativeElement.textContent).toContain('is in your wallet');
	});

	it('says when reserves fall short or cannot be read', () => {
		fixture.componentRef.setInput('reserves', reserves(999, 1000));
		expect(component.coverage()).toBe(1);
		expect(component.verdict()).toBe('short');

		fixture.componentRef.setInput('reserves', reserves(null, 4000));
		expect(component.verdict()).toBe('unknown');
		expect(component.coverage()).toBeNull();
	});
});
