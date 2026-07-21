/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Native Dependencies */
import {OrcBitcoinSubsectionOracleDisabledModule} from '@client/modules/bitcoin/modules/bitcoin-subsection-oracle-disabled/bitcoin-subsection-oracle-disabled.module';
/* Local Dependencies */
import {BitcoinSubsectionOracleDisabledComponent} from './bitcoin-subsection-oracle-disabled.component';

describe('BitcoinSubsectionOracleDisabledComponent', () => {
	let component: BitcoinSubsectionOracleDisabledComponent;
	let fixture: ComponentFixture<BitcoinSubsectionOracleDisabledComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcBitcoinSubsectionOracleDisabledModule],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(BitcoinSubsectionOracleDisabledComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
