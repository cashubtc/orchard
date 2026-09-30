/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashSubsectionWalletModule} from '@client/modules/ecash/modules/ecash-subsection-wallet/ecash-subsection-wallet.module';
/* Local Dependencies */
import {EcashSubsectionWalletComponent} from './ecash-subsection-wallet.component';

describe('EcashSubsectionWalletComponent', () => {
	let component: EcashSubsectionWalletComponent;
	let fixture: ComponentFixture<EcashSubsectionWalletComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashSubsectionWalletModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashSubsectionWalletComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
