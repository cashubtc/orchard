/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Application Dependencies */
import {NavService} from '@client/modules/nav/services/nav/nav.service';
/* Native Dependencies */
import {OrcEcashSectionModule} from '@client/modules/ecash/modules/ecash-section/ecash-section.module';
/* Local Dependencies */
import {EcashSectionComponent} from './ecash-section.component';

describe('EcashSectionComponent', () => {
	let component: EcashSectionComponent;
	let fixture: ComponentFixture<EcashSectionComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashSectionModule],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashSectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should source menu items from the nav service', () => {
		expect(component.menu_items).toEqual(TestBed.inject(NavService).getMenuItems('ecash'));
	});
});
