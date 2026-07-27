/* Core Dependencies */
import {ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
/* Vendor Dependencies */
import {of, Subject} from 'rxjs';
import {DateTime} from 'luxon';
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Application Dependencies */
import {provideChartConfig} from '@client/modules/chart/chart.providers';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {MintMetric} from '@client/modules/mint/classes/mint-metric.class';
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
	let route_data: Record<string, unknown>;

	beforeEach(async () => {
		ai_enabled = false;
		route_data = {};
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionSystemModule, MatIconTestingModule],
			providers: [
				provideChartConfig(),
				{
					provide: ActivatedRoute,
					useValue: {snapshot: {data: route_data}},
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

	it('should not flag auth or request auth families when the mint advertises no auth', () => {
		const mint_service = TestBed.inject(MintService) as unknown as {loadMintMetrics: jasmine.Spy};
		const args = mint_service.loadMintMetrics.calls.mostRecent().args[0];
		expect(component.auth_supported()).toBeFalse();
		expect(args.metrics).not.toContain('cdk_auth_attempts_total');
		expect(args.metrics).not.toContain('cdk_auth_successes_total');
	});

	it('should flag auth and request auth families when the mint advertises NUT-22', () => {
		route_data['mint_info'] = {nuts: {nut22: {bat_max_mint: 10, protected_endpoints: []}}};
		const auth_fixture = TestBed.createComponent(MintSubsectionSystemComponent);
		auth_fixture.detectChanges();
		const mint_service = TestBed.inject(MintService) as unknown as {loadMintMetrics: jasmine.Spy};
		const args = mint_service.loadMintMetrics.calls.mostRecent().args[0];
		expect(auth_fixture.componentInstance.auth_supported()).toBeTrue();
		expect(args.metrics).toContain('cdk_auth_attempts_total');
		expect(args.metrics).toContain('cdk_auth_successes_total');
	});

	it('should clear cache and refetch on refresh', () => {
		const mint_service = TestBed.inject(MintService) as unknown as {clearMetricsCache: jasmine.Spy};
		component.onRefresh();
		expect(mint_service.clearMetricsCache).toHaveBeenCalled();
		expect(component.refreshing()).toBeFalse();
	});

	it('should resolve a rolling window and derive the interval on preset change', () => {
		component.onPresetChange(DateRangePreset.Last5Minutes);
		const settings = component.page_settings();
		expect(settings?.date_preset).toBe(DateRangePreset.Last5Minutes);
		expect(settings?.interval).toBe(SystemMetricsInterval.Minute);
		expect((settings?.date_end ?? 0) - (settings?.date_start ?? 0)).toBe(5 * 60);
	});

	it('should re-resolve a rolling preset window on interval change', () => {
		const before = Math.floor(Date.now() / 1000);
		component.page_settings.set({
			date_start: 0,
			date_end: 900,
			date_preset: DateRangePreset.Last15Minutes,
			interval: SystemMetricsInterval.Minute,
		});
		component.onIntervalChange(SystemMetricsInterval.Hour);
		const settings = component.page_settings();
		expect(settings?.interval).toBe(SystemMetricsInterval.Hour);
		expect(settings?.date_end).toBeGreaterThanOrEqual(before);
		expect((settings?.date_end ?? 0) - (settings?.date_start ?? 0)).toBe(15 * 60);
	});

	it('should slide a rolling preset window forward on refresh', () => {
		const mint_service = TestBed.inject(MintService) as unknown as {loadMintMetrics: jasmine.Spy};
		const before = Math.floor(Date.now() / 1000);
		component.page_settings.set({
			date_start: 0,
			date_end: 900,
			date_preset: DateRangePreset.Last15Minutes,
			interval: SystemMetricsInterval.Minute,
		});
		component.onRefresh();
		const args = mint_service.loadMintMetrics.calls.mostRecent().args[0];
		expect(args.date_end).toBeGreaterThanOrEqual(before);
		expect(args.date_end - args.date_start).toBe(15 * 60);
		expect(component.page_settings()?.date_end).toBe(args.date_end);
	});

	it('should silently auto-advance a rolling minute window every minute', fakeAsync(() => {
		const mint_service = TestBed.inject(MintService) as unknown as {loadMintMetrics: jasmine.Spy};
		const live_fixture = TestBed.createComponent(MintSubsectionSystemComponent);
		live_fixture.detectChanges();
		live_fixture.componentInstance.page_settings.set({
			date_start: 0,
			date_end: 900,
			date_preset: DateRangePreset.Last15Minutes,
			interval: SystemMetricsInterval.Minute,
		});
		const before = Math.floor(Date.now() / 1000);
		const calls_before = mint_service.loadMintMetrics.calls.count();
		tick(60000);
		expect(mint_service.loadMintMetrics.calls.count()).toBe(calls_before + 1);
		const args = mint_service.loadMintMetrics.calls.mostRecent().args[0];
		expect(args.date_end).toBeGreaterThanOrEqual(before);
		expect(args.date_end - args.date_start).toBe(15 * 60);
		expect(live_fixture.componentInstance.loading_metrics()).toBeFalse();
		discardPeriodicTasks();
	}));

	it('should drop a stale auto-refresh response once a manual refresh supersedes it', fakeAsync(() => {
		const mint_service = TestBed.inject(MintService) as unknown as {loadMintMetrics: jasmine.Spy};
		const live_fixture = TestBed.createComponent(MintSubsectionSystemComponent);
		live_fixture.detectChanges();
		live_fixture.componentInstance.page_settings.set({
			date_start: 0,
			date_end: 900,
			date_preset: DateRangePreset.Last15Minutes,
			interval: SystemMetricsInterval.Minute,
		});
		const stale_response = new Subject<MintMetric[]>();
		mint_service.loadMintMetrics.and.returnValue(stale_response);
		tick(60000);
		const fresh = [{metric: 'cdk_mint_operations_total', date: 60, value: 1}] as unknown as MintMetric[];
		mint_service.loadMintMetrics.and.returnValue(of(fresh));
		live_fixture.componentInstance.onRefresh();
		stale_response.next([]);
		expect(live_fixture.componentInstance.metrics()).toEqual(fresh);
		discardPeriodicTasks();
	}));

	it('should not auto-advance without a rolling minute window', fakeAsync(() => {
		const mint_service = TestBed.inject(MintService) as unknown as {loadMintMetrics: jasmine.Spy};
		const live_fixture = TestBed.createComponent(MintSubsectionSystemComponent);
		live_fixture.detectChanges();
		live_fixture.componentInstance.page_settings.set({
			date_start: 0,
			date_end: 900,
			date_preset: null,
			interval: SystemMetricsInterval.Minute,
		});
		const calls_before = mint_service.loadMintMetrics.calls.count();
		tick(60000);
		live_fixture.componentInstance.page_settings.set({
			date_start: 0,
			date_end: 900,
			date_preset: DateRangePreset.Last6Hours,
			interval: SystemMetricsInterval.Hour,
		});
		tick(60000);
		expect(mint_service.loadMintMetrics.calls.count()).toBe(calls_before);
		discardPeriodicTasks();
	}));

	it('should route a DATE_RANGE_UPDATE tool call to onDateChange with unix timestamps', () => {
		const on_date_change = spyOn(component, 'onDateChange');
		const tool_call = {
			function: {name: AssistantToolName.DateRangeUpdate, arguments: {date_start: '2025-01-01', date_end: '2025-01-31'}},
		} as unknown as AiChatToolCall;
		component['executeAssistantFunction'](tool_call);
		const expected_start = DateTime.fromFormat('2025-01-01', 'yyyy-MM-dd').startOf('day').toUnixInteger();
		const expected_end = DateTime.fromFormat('2025-01-31', 'yyyy-MM-dd').endOf('day').toUnixInteger();
		expect(on_date_change).toHaveBeenCalledWith([expected_start, expected_end]);
	});

	it('should ignore a DATE_RANGE_UPDATE tool call with invalid dates', () => {
		const on_date_change = spyOn(component, 'onDateChange');
		const tool_call = {
			function: {name: AssistantToolName.DateRangeUpdate, arguments: {date_start: 'invalid', date_end: '2025-01-31'}},
		} as unknown as AiChatToolCall;
		component['executeAssistantFunction'](tool_call);
		expect(on_date_change).not.toHaveBeenCalled();
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
