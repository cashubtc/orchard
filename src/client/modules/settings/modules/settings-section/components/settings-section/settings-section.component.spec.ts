/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Application Dependencies */
import {NavService} from '@client/modules/nav/services/nav/nav.service';
import {FormPanelService} from '@client/modules/form/services/form-panel';
/* Native Dependencies */
import {OrcSettingsSectionModule} from '@client/modules/settings/modules/settings-section/settings-section.module';
/* Local Dependencies */
import {SettingsSectionComponent} from './settings-section.component';

describe('SettingsSectionComponent', () => {
	let component: SettingsSectionComponent;
	let fixture: ComponentFixture<SettingsSectionComponent>;
	let register_container: jasmine.Spy;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcSettingsSectionModule],
			providers: [provideRouter([])],
		}).compileComponents();

		register_container = spyOn(TestBed.inject(FormPanelService), 'registerContainer').and.callThrough();
		fixture = TestBed.createComponent(SettingsSectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should source menu items from the nav service', () => {
		expect(component.menu_items).toEqual(TestBed.inject(NavService).getMenuItems('settings'));
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
