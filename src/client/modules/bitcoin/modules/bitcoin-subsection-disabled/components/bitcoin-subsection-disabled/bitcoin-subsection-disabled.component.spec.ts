/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcBitcoinSubsectionDisabledModule} from '@client/modules/bitcoin/modules/bitcoin-subsection-disabled/bitcoin-subsection-disabled.module';
/* Local Dependencies */
import {BitcoinSubsectionDisabledComponent} from './bitcoin-subsection-disabled.component';

describe('BitcoinSubsectionDisabledComponent', () => {
	let component: BitcoinSubsectionDisabledComponent;
	let fixture: ComponentFixture<BitcoinSubsectionDisabledComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MatIconTestingModule, OrcBitcoinSubsectionDisabledModule],
		}).compileComponents();

		fixture = TestBed.createComponent(BitcoinSubsectionDisabledComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
