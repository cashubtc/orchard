/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Vendor Dependencies */
import {MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA} from '@angular/material/bottom-sheet';
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcNavModule} from '@client/modules/nav/nav.module';
/* Local Dependencies */
import {NavMobileSheetMenuSectionComponent} from './nav-mobile-sheet-menu-section.component';

describe('NavMobileSheetMenuSectionComponent', () => {
	let component: NavMobileSheetMenuSectionComponent;
	let fixture: ComponentFixture<NavMobileSheetMenuSectionComponent>;

	beforeEach(async () => {
		const mock_bottom_sheet_ref = {
			dismiss: jasmine.createSpy('dismiss'),
		};

		await TestBed.configureTestingModule({
			imports: [OrcNavModule, MatIconTestingModule],
			providers: [
				provideRouter([]),
				{provide: MatBottomSheetRef, useValue: mock_bottom_sheet_ref},
				{
					provide: MAT_BOTTOM_SHEET_DATA,
					useValue: {
						active_section: 'index',
						enabled_bitcoin: false,
						enabled_lightning: false,
						enabled_mint: false,
						online_bitcoin: true,
						online_lightning: true,
						online_mint: true,
						syncing_bitcoin: false,
						syncing_lightning: false,
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(NavMobileSheetMenuSectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('leaves home and settings available when no services are configured', () => {
		const links = Array.from(fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>);
		expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/ecash', '/settings']);
	});
});
