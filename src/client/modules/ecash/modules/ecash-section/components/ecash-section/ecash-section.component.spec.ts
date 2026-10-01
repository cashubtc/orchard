/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Application Dependencies */
import {NavService} from '@client/modules/nav/services/nav/nav.service';
import {FormPanelService} from '@client/modules/form/services/form-panel';
/* Native Dependencies */
import {OrcEcashSectionModule} from '@client/modules/ecash/modules/ecash-section/ecash-section.module';
/* Local Dependencies */
import {EcashSectionComponent} from './ecash-section.component';

describe('EcashSectionComponent', () => {
	let component: EcashSectionComponent;
	let fixture: ComponentFixture<EcashSectionComponent>;
	let register_container: jasmine.Spy;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashSectionModule],
			providers: [provideRouter([])],
		}).compileComponents();

		register_container = spyOn(TestBed.inject(FormPanelService), 'registerContainer').and.callThrough();
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

	it('should open form panels in a bottom sheet only on mobile', () => {
		const [, {sheet}] = register_container.calls.mostRecent().args;
		component.device_type.set('desktop');
		expect(sheet()).toBeFalse();
		component.device_type.set('tablet');
		expect(sheet()).toBeFalse();
		component.device_type.set('mobile');
		expect(sheet()).toBeTrue();
	});
});
