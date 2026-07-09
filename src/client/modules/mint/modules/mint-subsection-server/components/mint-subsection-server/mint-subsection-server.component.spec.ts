/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
/* Vendor Dependencies */
import {of} from 'rxjs';
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Application Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
/* Native Dependencies */
import {OrcMintSubsectionServerModule} from '@client/modules/mint/modules/mint-subsection-server/mint-subsection-server.module';
/* Local Dependencies */
import {MintSubsectionServerComponent} from './mint-subsection-server.component';

describe('MintSubsectionServerComponent', () => {
	let component: MintSubsectionServerComponent;
	let fixture: ComponentFixture<MintSubsectionServerComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionServerModule, MatIconTestingModule],
			providers: [
				provideNoopAnimations(),
				{
					provide: ActivatedRoute,
					useValue: {snapshot: {data: {mint_metrics_snapshot: []}}},
				},
				{
					provide: MintService,
					useValue: {
						loadMintMetrics: jasmine.createSpy('loadMintMetrics').and.returnValue(of([])),
						getMintMetricsSnapshot: jasmine.createSpy('getMintMetricsSnapshot').and.returnValue(of([])),
						clearMetricsCache: jasmine.createSpy('clearMetricsCache'),
					},
				},
				{
					provide: SettingDeviceService,
					useValue: {
						getLocale: jasmine.createSpy('getLocale').and.returnValue('en-US'),
						getTimezone: jasmine.createSpy('getTimezone').and.returnValue('UTC'),
						getTheme: jasmine.createSpy('getTheme').and.returnValue('dark-mode'),
						getMintServerSettings: jasmine
							.createSpy('getMintServerSettings')
							.and.returnValue({date_start: null, date_end: null, date_preset: null, interval: null}),
						setMintServerSettings: jasmine.createSpy('setMintServerSettings'),
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionServerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should load metrics on init with default settings', () => {
		const settings = component.page_settings();
		expect(settings).not.toBeNull();
		expect(settings?.interval).toBeTruthy();
		expect(component.loading_metrics()).toBeFalse();
	});

	it('should clear cache, refetch and pulse on refresh', () => {
		const mint_service = TestBed.inject(MintService) as unknown as {clearMetricsCache: jasmine.Spy};
		component.onRefresh();
		expect(mint_service.clearMetricsCache).toHaveBeenCalled();
		expect(component.refreshing()).toBeFalse();
		expect(component.pulsing()).toBeTrue();
	});
});
