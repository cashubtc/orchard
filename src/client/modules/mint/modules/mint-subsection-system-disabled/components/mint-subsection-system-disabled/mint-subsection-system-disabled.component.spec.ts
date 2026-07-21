/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintSubsectionSystemDisabledModule} from '@client/modules/mint/modules/mint-subsection-system-disabled/mint-subsection-system-disabled.module';
/* Local Dependencies */
import {MintSubsectionSystemDisabledComponent} from './mint-subsection-system-disabled.component';

describe('MintSubsectionSystemDisabledComponent', () => {
	let component: MintSubsectionSystemDisabledComponent;
	let fixture: ComponentFixture<MintSubsectionSystemDisabledComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionSystemDisabledModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionSystemDisabledComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
