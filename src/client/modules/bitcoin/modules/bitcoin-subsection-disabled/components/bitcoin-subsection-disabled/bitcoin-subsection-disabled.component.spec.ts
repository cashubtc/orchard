/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router, provideRouter, type UrlTree} from '@angular/router';
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
			providers: [provideRouter([])],
			imports: [MatIconTestingModule, OrcBitcoinSubsectionDisabledModule],
		}).compileComponents();

		fixture = TestBed.createComponent(BitcoinSubsectionDisabledComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('links to service settings', () => {
		expect(component).toBeTruthy();
		const router = TestBed.inject(Router);
		const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
		fixture.nativeElement.querySelector('button').click();
		expect(router.serializeUrl(navigate.calls.mostRecent().args[0] as UrlTree)).toBe('/settings/services');
	});
});
