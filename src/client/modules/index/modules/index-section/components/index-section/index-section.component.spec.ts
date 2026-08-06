/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {RouterOutlet, ActivatedRoute} from '@angular/router';
/* Vendor Dependencies */
import {of} from 'rxjs';
/* Application Dependencies */
import {NavService} from '@client/modules/nav/services/nav/nav.service';
/* Native Dependencies */
import {OrcIndexSectionModule} from '@client/modules/index/modules/index-section/index-section.module';
/* Local Dependencies */
import {IndexSectionComponent} from './index-section.component';

describe('IndexSectionComponent', () => {
	let component: IndexSectionComponent;
	let fixture: ComponentFixture<IndexSectionComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcIndexSectionModule, RouterOutlet],
			declarations: [IndexSectionComponent],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: {
						params: of({}),
						queryParams: of({}),
						snapshot: {params: {}, queryParams: {}},
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(IndexSectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should source menu items from the nav service', () => {
		expect(component.menu_items).toEqual(TestBed.inject(NavService).getMenuItems('index'));
	});
});
