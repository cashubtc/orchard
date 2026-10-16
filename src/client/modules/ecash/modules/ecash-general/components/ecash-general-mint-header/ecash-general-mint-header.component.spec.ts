/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralMintHeaderComponent} from './ecash-general-mint-header.component';

describe('EcashGeneralMintHeaderComponent', () => {
	let component: EcashGeneralMintHeaderComponent;
	let fixture: ComponentFixture<EcashGeneralMintHeaderComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintHeaderComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('name', 'Cedar Mint');
		fixture.componentRef.setInput('subtitle', 'mint.cedar.example');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
		expect(fixture.nativeElement.textContent).toContain('Cedar Mint');
	});

	it('marks the mint Orchard runs in its subtitle', () => {
		expect(component.detail()).toBe('mint.cedar.example');
		fixture.componentRef.setInput('is_orchard', true);
		expect(component.detail()).toBe('mint.cedar.example · Your Orchard mint');
	});
});
