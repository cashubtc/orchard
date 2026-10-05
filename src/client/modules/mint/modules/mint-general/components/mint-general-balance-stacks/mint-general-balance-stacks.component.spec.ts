/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
/* Local Dependencies */
import {MintGeneralBalanceStacksComponent} from './mint-general-balance-stacks.component';

describe('MintGeneralBalanceStacksComponent', () => {
	let component: MintGeneralBalanceStacksComponent;
	let fixture: ComponentFixture<MintGeneralBalanceStacksComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintGeneralBalanceStacksComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('assets', 0);
		fixture.componentRef.setInput('liabilities', 0);
		fixture.componentRef.setInput('unit', 'sat');
		fixture.componentRef.setInput('solvency', null);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
