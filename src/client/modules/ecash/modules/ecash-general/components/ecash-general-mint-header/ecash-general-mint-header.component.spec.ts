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
		const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');
		expect(text()).not.toContain('Your Orchard mint');
		fixture.componentRef.setInput('is_orchard', true);
		fixture.detectChanges();
		expect(text()).toContain('mint.cedar.example · Your Orchard mint');
	});

	it('flags a mint without a public URL in amber', () => {
		fixture.componentRef.setInput('subtitle', null);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.orc-status-warning-color')?.textContent).toBe('No public URL');
	});
});
