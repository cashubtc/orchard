/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
/* Vendor Dependencies */
import {of, Subject} from 'rxjs';
import {DateTime} from 'luxon';
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Application Dependencies */
import {provideChartConfig} from '@client/modules/chart/chart.providers';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
/* Native Dependencies */
import {OrcIndexSubsectionSystemModule} from '@client/modules/index/modules/index-subsection-system/index-subsection-system.module';
import {SystemService} from '@client/modules/index/services/system/system.service';
import {SystemInfo} from '@client/modules/index/classes/system-info.class';
import {SystemMetricSample} from '@client/modules/index/classes/system-metric.class';
/* Local Dependencies */
import {IndexSubsectionSystemComponent} from './index-subsection-system.component';
/* Shared Dependencies */
import {AssistantToolName, SystemMetric, SystemMetricsInterval} from '@shared/generated.types';

const mock_system_info = new SystemInfo({
	os_platform: 'linux',
	os_release: '6.8.0',
	arch: 'arm64',
	cpu_model: 'Apple M2',
	cpu_cores: 8,
	memory_total_bytes: 17179869184,
	disk_total_bytes: 512000000000,
	node_version: 'v22.3.0',
	v8_version: '12.4.254.21-node.19',
	heap_limit_mb: 4144,
});

describe('IndexSubsectionSystemComponent', () => {
	let component: IndexSubsectionSystemComponent;
	let fixture: ComponentFixture<IndexSubsectionSystemComponent>;
	let ai_service: {assistant_requests$: Subject<unknown>; tool_calls$: Subject<AiChatToolCall>; openAiSocket: jasmine.Spy};
	let ai_enabled: boolean;

	beforeEach(async () => {
		ai_enabled = false;
		await TestBed.configureTestingModule({
			imports: [OrcIndexSubsectionSystemModule, MatIconTestingModule],
			providers: [
				provideChartConfig(),
				{
					provide: ActivatedRoute,
					useValue: {snapshot: {data: {}}},
				},
				{
					provide: SystemService,
					useValue: {
						loadSystemMetrics: jasmine.createSpy('loadSystemMetrics').and.returnValue(of([])),
						loadSystemInfo: jasmine.createSpy('loadSystemInfo').and.returnValue(of(mock_system_info)),
						clearMetricsCache: jasmine.createSpy('clearMetricsCache'),
					},
				},
				{
					provide: SettingDeviceService,
					useValue: {
						getLocale: jasmine.createSpy('getLocale').and.returnValue('en-US'),
						getTimezone: jasmine.createSpy('getTimezone').and.returnValue('UTC'),
						getTheme: jasmine.createSpy('getTheme').and.returnValue('dark-mode'),
						getSystemMetricsSettings: jasmine
							.createSpy('getSystemMetricsSettings')
							.and.returnValue({date_start: null, date_end: null, date_preset: null, interval: null}),
						setSystemMetricsSettings: jasmine.createSpy('setSystemMetricsSettings'),
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
		fixture = TestBed.createComponent(IndexSubsectionSystemComponent);
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

	it('should load system info on init', () => {
		expect(component.system_info()).toEqual(mock_system_info);
		expect(component.loading_info()).toBeFalse();
	});

	it('should divide the load series by cpu cores when info is known', () => {
		component.metrics.set([new SystemMetricSample({metric: SystemMetric.LoadAvg_1m, date: 60, value: 4, min: 2, max: 8})]);
		const load = component.load_metrics();
		expect(load[0].value).toBe(0.5);
		expect(load[0].min).toBe(0.25);
		expect(load[0].max).toBe(1);
		expect(component.load_reference()).toEqual({value: 1, label: 'all cores busy'});
		expect(component.load_subtitle()).toBe('load per core · 1m · 5m · 15m');
	});

	it('should fall back to the raw load series when info failed to load', () => {
		component.system_info.set(null);
		component.metrics.set([new SystemMetricSample({metric: SystemMetric.LoadAvg_1m, date: 60, value: 4})]);
		expect(component.load_metrics()[0].value).toBe(4);
		expect(component.load_reference()).toBeUndefined();
		expect(component.load_subtitle()).toBe('runnable processes · 1m · 5m · 15m');
	});

	it('should anchor chart subtitles with totals from system info', () => {
		expect(component.memory_total_label()).toBe('16 GB');
		expect(component.heap_reference()).toEqual({value: 4144, label: 'heap limit'});
	});

	it('should clear cache and refetch on refresh', () => {
		const system_service = TestBed.inject(SystemService) as unknown as {clearMetricsCache: jasmine.Spy};
		component.onRefresh();
		expect(system_service.clearMetricsCache).toHaveBeenCalled();
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
		const enabled_fixture = TestBed.createComponent(IndexSubsectionSystemComponent);
		enabled_fixture.detectChanges();
		ai_service.assistant_requests$.next({assistant: 'SYSTEM', content: 'last 24 hours'});
		expect(ai_service.openAiSocket).toHaveBeenCalled();
	});
});
