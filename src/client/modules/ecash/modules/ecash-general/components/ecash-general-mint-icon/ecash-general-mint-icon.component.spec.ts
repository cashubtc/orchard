/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralMintIconComponent} from './ecash-general-mint-icon.component';

describe('EcashGeneralMintIconComponent', () => {
	let component: EcashGeneralMintIconComponent;
	let fixture: ComponentFixture<EcashGeneralMintIconComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralMintIconComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('name', 'Cedar Community Mint');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('shows initials when the mint has no icon', () => {
		expect(fixture.nativeElement.textContent.trim()).toBe('CC');
	});

	it('falls back to initials when the icon fails to load', () => {
		fixture.componentRef.setInput('icon_url', 'https://cedar.example/icon.png');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('img')).not.toBeNull();

		component.onIconError();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('img')).toBeNull();
		expect(fixture.nativeElement.textContent.trim()).toBe('CC');
	});
});
