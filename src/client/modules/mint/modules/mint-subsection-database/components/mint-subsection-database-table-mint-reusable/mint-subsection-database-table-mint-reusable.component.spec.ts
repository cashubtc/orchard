/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintSubsectionDatabaseModule} from '@client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module';
import {MintQuoteState} from '@shared/generated.types';
/* Local Dependencies */
import {MintSubsectionDatabaseTableMintReusableComponent} from './mint-subsection-database-table-mint-reusable.component';

describe('MintSubsectionDatabaseTableMintReusableComponent', () => {
	let component: MintSubsectionDatabaseTableMintReusableComponent;
	let fixture: ComponentFixture<MintSubsectionDatabaseTableMintReusableComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionDatabaseModule],
			declarations: [MintSubsectionDatabaseTableMintReusableComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionDatabaseTableMintReusableComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('quote', {
			amount_paid: 0,
			amount_issued: 0,
			unit: 'sat',
			state: MintQuoteState.Unpaid,
		} as any);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should return zero percent when no amount has been paid', () => {
		fixture.componentRef.setInput('quote', {
			amount_paid: 0,
			amount_issued: 0,
			unit: 'sat',
			state: MintQuoteState.Unpaid,
		} as any);

		expect(component.percentage_issued()).toBe(0);
	});
});
