/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
/* Vendor Dependencies */
import {of, Subject} from 'rxjs';
import {DateTime} from 'luxon';
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Application Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
/* Native Dependencies */
import {OrcMintSubsectionSystemModule} from '@client/modules/mint/modules/mint-subsection-system/mint-subsection-system.module';
/* Local Dependencies */
import {MintSubsectionSystemComponent} from './mint-subsection-system.component';
/* Shared Dependencies */
import {AssistantToolName, SystemMetricsInterval} from '@shared/generated.types';

describe('MintSubsectionSystemComponent', () => {
	let component: MintSubsectionSystemComponent;
	let fixture: ComponentFixture<MintSubsectionSystemComponent>;
	let ai_service: {assistant_requests$: Subject<unknown>; tool_calls$: Subject<AiChatToolCall>; openAiSocket: jasmine.Spy};
	let ai_enabled: boolean;

	beforeEach(async () => {
		ai_enabled = false;
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionSystemModule, MatIconTestingModule],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: {snapshot: {data: {}}},
				},
				{
					provide: MintService,
					useValue: {
						loadMintMetrics: jasmine.createSpy('loadMintMetrics').and.returnValue(of([])),
						clearMetricsCache: jasmine.createSpy('clearMetricsCache'),
					},
				},
				{
					provide: SettingDeviceService,
					useValue: {
						getLocale: jasmine.createSpy('getLocale').and.returnValue('en-US'),
						getTimezone: jasmine.createSpy('getTimezone').and.returnValue('UTC'),
						getTheme: jasmine.createSpy('getTheme').and.returnValue('dark-mode'),
						getMintSystemSettings: jasmine
							.createSpy('getMintSystemSettings')
							.and.returnValue({date_start: null, date_end: null, date_preset: null, interval: null}),
						setMintSystemSettings: jasmine.createSpy('setMintSystemSettings'),
					},
				},
				{
					provide: SettingAppService,
					useValue: {
						getSetting: jasmine.createSpy('getSetting').and.callFake(() => ({value: ai_enabled})),
					},
				},
				{
					provide: AiService,
					useValue: {
						assistant_requests$: new Subject<unknown>(),
						tool_calls$: new Subject<AiChatToolCall>(),
						openAiSocket: jasmine.createSpy('openAiSocket'),
					},
				},
			],
		}).compileComponents();

		ai_service = TestBed.inject(AiService) as unknown as typeof ai_service;
		fixture = TestBed.createComponent(MintSubsectionSystemComponent);
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

	it('should clear cache and refetch on refresh', () => {
		const mint_service = TestBed.inject(MintService) as unknown as {clearMetricsCache: jasmine.Spy};
		component.onRefresh();
		expect(mint_service.clearMetricsCache).toHaveBeenCalled();
		expect(component.refreshing()).toBeFalse();
	});

	it('should route a DATE_RANGE_UPDATE tool call to onDateChange with unix timestamps', () => {
		const on_date_change = spyOn(component, 'onDateChange');
		const tool_call = {
			function: {name: AssistantToolName.DateRangeUpdate, arguments: {date_start: '2025-01-01', date_end: '2025-01-31'}},
		} as unknown as AiChatToolCall;
		component['executeAssistantFunction'](tool_call);
		const expected_start = DateTime.fromFormat('2025-01-01', 'yyyy-MM-dd').toUnixInteger();
		const expected_end = DateTime.fromFormat('2025-01-31', 'yyyy-MM-dd').toUnixInteger();
		expect(on_date_change).toHaveBeenCalledWith([expected_start, expected_end]);
	});

	it('should route a METRICS_INTERVAL_UPDATE tool call to onIntervalChange', () => {
		const on_interval_change = spyOn(component, 'onIntervalChange');
		const tool_call = {
			function: {name: AssistantToolName.MetricsIntervalUpdate, arguments: {interval: SystemMetricsInterval.Minute}},
		} as unknown as AiChatToolCall;
		component['executeAssistantFunction'](tool_call);
		expect(on_interval_change).toHaveBeenCalledWith(SystemMetricsInterval.Minute);
	});

	it('should not wire the assistant when ai is disabled', () => {
		ai_service.assistant_requests$.next({assistant: 'SYSTEM', content: 'last 24 hours'});
		expect(ai_service.openAiSocket).not.toHaveBeenCalled();
	});

	it('should push page context to the assistant when ai is enabled', () => {
		ai_enabled = true;
		const enabled_fixture = TestBed.createComponent(MintSubsectionSystemComponent);
		enabled_fixture.detectChanges();
		ai_service.assistant_requests$.next({assistant: 'SYSTEM', content: 'last 24 hours'});
		expect(ai_service.openAiSocket).toHaveBeenCalled();
	});
});
