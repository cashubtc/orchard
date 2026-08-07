/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Application Dependencies */
import {NavService} from '@client/modules/nav/services/nav/nav.service';
/* Native Dependencies */
import {OrcMintSectionModule} from '@client/modules/mint/modules/mint-section/mint-section.module';
/* Local Dependencies */
import {MintSectionComponent} from './mint-section.component';

describe('MintSectionComponent', () => {
	let component: MintSectionComponent;
	let fixture: ComponentFixture<MintSectionComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSectionModule],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should source menu items from the nav service', () => {
		expect(component.menu_items).toEqual(TestBed.inject(NavService).getMenuItems('mint'));
	});
});
