/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintSubsectionDatabaseModule} from '@client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module';
/* Local Dependencies */
import {MintSubsectionDatabaseTableMintComponent} from './mint-subsection-database-table-mint.component';
/* Shared Dependencies */
import {MintQuoteState} from '@shared/generated.types';

describe('MintSubsectionDatabaseTableMintComponent', () => {
	let component: MintSubsectionDatabaseTableMintComponent;
	let fixture: ComponentFixture<MintSubsectionDatabaseTableMintComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionDatabaseModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionDatabaseTableMintComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('quote', {
			request: 'lnbc1...',
			state: 0,
		} as any);
		fixture.componentRef.setInput('loading', false);
		fixture.componentRef.setInput('bitcoin_oracle_data', null);
		fixture.componentRef.setInput('device_desktop', true);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
	it('disables quote overrides for members', () => {
		fixture.componentRef.setInput('quote', {request: 'lnbc1...', state: MintQuoteState.Unpaid});
		fixture.componentRef.setInput('allow_override', true);
		fixture.detectChanges();
		expect(component.can_set_paid()).toBeTrue();
		fixture.componentRef.setInput('allow_override', false);
		fixture.detectChanges();
		expect(component.can_set_paid()).toBeFalse();
	});
});
