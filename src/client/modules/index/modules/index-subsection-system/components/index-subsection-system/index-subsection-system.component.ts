/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, OnDestroy, computed, inject, signal} from '@angular/core';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {NonNullableSystemMetricsSettings} from '@client/modules/settings/types/setting.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {resolveDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {deviceTypeFromBreakpoints} from '@client/modules/layout/helpers/device.helpers';
import {resolveSystemMetricsSettings, getMetricsGenesisTime} from '@client/modules/system/helpers/system-settings.helpers';
import {buildSystemAssistantContext, parseAssistantDateRange} from '@client/modules/system/helpers/system-assistant.helpers';
/* Native Dependencies */
import {SystemService} from '@client/modules/index/services/system/system.service';
import {SystemMetricSample} from '@client/modules/index/classes/system-metric.class';
import {formatUptime} from '@client/modules/index/helpers/system-uptime.helpers';
/* Shared Dependencies */
import {AssistantToolName, SystemMetric, SystemMetricsInterval} from '@shared/generated.types';

const SYSTEM_METRIC_FAMILIES: SystemMetric[] = [
	SystemMetric.CpuPercent,
	SystemMetric.MemoryRssMb,
	SystemMetric.MemoryPercent,
	SystemMetric.DiskPercent,
	SystemMetric.LoadAvg_1m,
	SystemMetric.LoadAvg_5m,
	SystemMetric.LoadAvg_15m,
	SystemMetric.HeapUsedMb,
	SystemMetric.HeapTotalMb,
	SystemMetric.UptimeSystem,
	SystemMetric.UptimeProcess,
];

/** Chart series labels for the host metric families */
const METRIC_LABELS: Record<string, string> = {
	cpu_percent: 'CPU',
	memory_percent: 'Memory',
	memory_rss_mb: 'Memory',
	disk_percent: 'Disk',
	load_avg_1m: '1m',
	load_avg_5m: '5m',
	load_avg_15m: '15m',
	heap_used_mb: 'Heap used',
	heap_total_mb: 'Heap total',
};

@Component({
	selector: 'orc-index-subsection-system',
	standalone: false,
	templateUrl: './index-subsection-system.component.html',
	styleUrl: './index-subsection-system.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexSubsectionSystemComponent implements OnInit, OnDestroy {
	private readonly systemService = inject(SystemService);
	private readonly settingDeviceService = inject(SettingDeviceService);
	private readonly settingAppService = inject(SettingAppService);
	private readonly aiService = inject(AiService);
	private readonly breakpointObserver = inject(BreakpointObserver);

	public locale!: string;
	public readonly metric_labels = METRIC_LABELS;

	public readonly page_settings = signal<NonNullableSystemMetricsSettings | null>(null);
	public readonly metrics = signal<SystemMetricSample[]>([]);
	public readonly loading_metrics = signal<boolean>(true);
	public readonly refreshing = signal<boolean>(false);
	public readonly device_type = signal<DeviceType>('desktop');

	public readonly cpu_metrics = computed(() => this.filterMetrics([SystemMetric.CpuPercent]));
	public readonly memory_rss_metrics = computed(() => this.filterMetrics([SystemMetric.MemoryRssMb]));
	public readonly memory_percent_metrics = computed(() => this.filterMetrics([SystemMetric.MemoryPercent]));
	public readonly disk_metrics = computed(() => this.filterMetrics([SystemMetric.DiskPercent]));
	public readonly load_metrics = computed(() =>
		this.filterMetrics([SystemMetric.LoadAvg_1m, SystemMetric.LoadAvg_5m, SystemMetric.LoadAvg_15m]),
	);
	public readonly heap_metrics = computed(() => this.filterMetrics([SystemMetric.HeapUsedMb, SystemMetric.HeapTotalMb]));
	public readonly uptime_system_label = computed(() => formatUptime(this.latestValue(SystemMetric.UptimeSystem)));
	public readonly uptime_process_label = computed(() => formatUptime(this.latestValue(SystemMetric.UptimeProcess)));

	private subscriptions = new Subscription();

	ngOnInit(): void {
		this.locale = this.settingDeviceService.getLocale();
		this.page_settings.set(this.getPageSettings());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.orchardOptionalInit();
		this.loadMetrics();
	}

	/** Registers AI assistant subscriptions when the assistant is enabled */
	private orchardOptionalInit(): void {
		if (this.settingAppService.getSetting('ai_enabled').value) {
			this.subscriptions.add(this.getAssistantSubscription());
			this.subscriptions.add(this.getToolSubscription());
		}
	}

	/* *******************************************************
		Settings
	******************************************************** */

	/** Builds page settings from device settings with defaults for first visits */
	private getPageSettings(): NonNullableSystemMetricsSettings {
		return resolveSystemMetricsSettings(this.settingDeviceService.getSystemMetricsSettings());
	}

	private updateSettings(settings: NonNullableSystemMetricsSettings): void {
		this.page_settings.set(settings);
		this.settingDeviceService.setSystemMetricsSettings(settings);
		this.loadMetrics();
	}

	/* *******************************************************
		Subscriptions
	******************************************************** */

	private getBreakpointSubscription(): Subscription {
		return this.breakpointObserver
			.observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium])
			.subscribe((result) => this.device_type.set(deviceTypeFromBreakpoints(result)));
	}

	/* *******************************************************
		Data
	******************************************************** */

	/** Loads the stored metric series for the selected range and interval */
	private loadMetrics(): void {
		const settings = this.page_settings();
		if (!settings) return;
		this.loading_metrics.set(true);
		this.subscriptions.add(
			this.systemService
				.loadSystemMetrics({
					date_start: settings.date_start,
					date_end: settings.date_end,
					interval: settings.interval,
					timezone: this.settingDeviceService.getTimezone(),
					metrics: SYSTEM_METRIC_FAMILIES,
				})
				.subscribe({
					next: (metrics: SystemMetricSample[]) => {
						this.metrics.set(metrics);
						this.loading_metrics.set(false);
					},
					error: () => {
						this.metrics.set([]);
						this.loading_metrics.set(false);
					},
				}),
		);
	}

	private filterMetrics(metrics: SystemMetric[]): SystemMetricSample[] {
		return this.metrics().filter((m) => metrics.includes(m.metric));
	}

	/** Most recent sampled value for a single metric family */
	private latestValue(metric: SystemMetric): number | null {
		const series = this.metrics().filter((m) => m.metric === metric);
		if (series.length === 0) return null;
		return series.reduce((latest, m) => (m.date > latest.date ? m : latest)).value;
	}

	/** Forces a fresh fetch of the stored series, then pulses the page */
	public onRefresh(): void {
		const settings = this.page_settings();
		if (!settings || this.refreshing()) return;
		this.refreshing.set(true);
		this.loading_metrics.set(true);
		this.systemService.clearMetricsCache();
		this.subscriptions.add(
			this.systemService
				.loadSystemMetrics({
					date_start: settings.date_start,
					date_end: settings.date_end,
					interval: settings.interval,
					timezone: this.settingDeviceService.getTimezone(),
					metrics: SYSTEM_METRIC_FAMILIES,
				})
				.subscribe({
					next: (metrics: SystemMetricSample[]) => {
						this.metrics.set(metrics);
						this.loading_metrics.set(false);
						this.refreshing.set(false);
					},
					error: () => {
						this.loading_metrics.set(false);
						this.refreshing.set(false);
					},
				}),
		);
	}

	/* *******************************************************
		AI
	******************************************************** */

	/** Feeds the current page context to the assistant on each request */
	private getAssistantSubscription(): Subscription {
		return this.aiService.assistant_requests$.subscribe(({assistant, content}) => {
			const context = buildSystemAssistantContext(this.page_settings());
			this.aiService.openAiSocket(assistant, content, context);
		});
	}

	/** Dispatches assistant tool calls to the matching Actions-Up handlers */
	private getToolSubscription(): Subscription {
		return this.aiService.tool_calls$.subscribe((tool_call: AiChatToolCall) => {
			this.executeAssistantFunction(tool_call);
		});
	}

	/** Routes an assistant tool call to the corresponding page action */
	private executeAssistantFunction(tool_call: AiChatToolCall): void {
		if (tool_call.function.name === AssistantToolName.DateRangeUpdate) {
			this.onDateChange(parseAssistantDateRange(tool_call.function.arguments.date_start, tool_call.function.arguments.date_end));
		}
		if (tool_call.function.name === AssistantToolName.MetricsIntervalUpdate) {
			this.onIntervalChange(tool_call.function.arguments.interval);
		}
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	public onDateChange(dates: number[]): void {
		const settings = this.page_settings();
		if (!settings) return;
		this.updateSettings({...settings, date_start: dates[0], date_end: dates[1], date_preset: null});
	}

	public onPresetChange(preset: DateRangePreset): void {
		const settings = this.page_settings();
		if (!settings) return;
		const resolved_dates = resolveDateRangePreset(preset, getMetricsGenesisTime());
		this.updateSettings({...settings, date_start: resolved_dates.date_start, date_end: resolved_dates.date_end, date_preset: preset});
	}

	public onIntervalChange(interval: SystemMetricsInterval): void {
		const settings = this.page_settings();
		if (!settings) return;
		this.updateSettings({...settings, interval});
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
