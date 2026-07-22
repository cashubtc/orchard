/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, OnDestroy, computed, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {Subscription, timer} from 'rxjs';
/* Application Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {AiService} from '@client/modules/ai/services/ai/ai.service';
import {AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
import {NonNullableSystemMetricsSettings} from '@client/modules/settings/types/setting.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {deviceTypeFromBreakpoints} from '@client/modules/layout/helpers/device.helpers';
import {
	resolveSystemMetricsSettings,
	resolveMetricsDateRangePreset,
	suggestMetricsInterval,
	refreshMetricsRange,
	shouldAutoRefreshMetrics,
} from '@client/modules/system/helpers/system-settings.helpers';
import {buildSystemAssistantContext, parseAssistantDateRange} from '@client/modules/system/helpers/system-assistant.helpers';
/* Native Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {MintMetric} from '@client/modules/mint/classes/mint-metric.class';
import {computeHttpErrorRate, computeEndpointDistribution} from '@client/modules/mint/helpers/mint-http-metric.helpers';
/* Shared Dependencies */
import {AssistantToolName, SystemMetricsInterval} from '@shared/generated.types';

const CHART_METRIC_FAMILIES = [
	'cdk_mint_operations_total',
	'cdk_mint_operation_duration_seconds',
	'cdk_http_requests_total',
	'cdk_http_request_duration_seconds',
	'cdk_db_operations_total',
	'cdk_db_operation_duration_seconds',
	'cdk_errors_total',
	'process_cpu_usage_percent',
	'process_memory_bytes',
	'process_memory_percent',
	'cdk_mint_in_flight_requests',
	'cdk_db_connections_active',
	'cdk_wallet_operations_total',
	'cdk_payments_total',
];

// Requested only when the mint advertises auth (NUT-21/NUT-22)
const AUTH_METRIC_FAMILIES = ['cdk_auth_attempts_total', 'cdk_auth_successes_total'];

@Component({
	selector: 'orc-mint-subsection-system',
	standalone: false,
	templateUrl: './mint-subsection-system.component.html',
	styleUrl: './mint-subsection-system.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionSystemComponent implements OnInit, OnDestroy {
	private readonly mintService = inject(MintService);
	private readonly settingDeviceService = inject(SettingDeviceService);
	private readonly settingAppService = inject(SettingAppService);
	private readonly aiService = inject(AiService);
	private readonly breakpointObserver = inject(BreakpointObserver);
	private readonly route = inject(ActivatedRoute);

	public locale!: string;

	public readonly page_settings = signal<NonNullableSystemMetricsSettings | null>(null);
	public readonly metrics = signal<MintMetric[]>([]);
	public readonly loading_metrics = signal<boolean>(true);
	public readonly refreshing = signal<boolean>(false);
	public readonly device_type = signal<DeviceType>('desktop');
	public readonly auth_supported = signal<boolean>(false);

	public readonly operations_metrics = computed(() => this.filterMetrics('cdk_mint_operations_total'));
	public readonly operation_duration_metrics = computed(() => this.filterMetrics('cdk_mint_operation_duration_seconds'));
	public readonly http_requests_metrics = computed(() => this.filterMetrics('cdk_http_requests_total'));
	public readonly http_duration_metrics = computed(() => this.filterMetrics('cdk_http_request_duration_seconds'));
	public readonly db_operations_metrics = computed(() => this.filterMetrics('cdk_db_operations_total'));
	public readonly db_duration_metrics = computed(() => this.filterMetrics('cdk_db_operation_duration_seconds'));
	public readonly errors_metrics = computed(() => this.filterMetrics('cdk_errors_total'));
	public readonly cpu_metrics = computed(() => this.filterMetrics('process_cpu_usage_percent'));
	public readonly memory_metrics = computed(() => this.filterMetrics('process_memory_bytes'));
	public readonly memory_percent_metrics = computed(() => this.filterMetrics('process_memory_percent'));
	public readonly in_flight_metrics = computed(() => this.filterMetrics('cdk_mint_in_flight_requests'));
	public readonly db_connections_metrics = computed(() => this.filterMetrics('cdk_db_connections_active'));
	public readonly auth_metrics = computed(() =>
		this.metrics().filter((metric) => metric.metric === 'cdk_auth_attempts_total' || metric.metric === 'cdk_auth_successes_total'),
	);
	public readonly wallet_metrics = computed(() =>
		this.metrics().filter((metric) => metric.metric === 'cdk_wallet_operations_total' || metric.metric === 'cdk_payments_total'),
	);
	public readonly http_error_rate = computed(() => computeHttpErrorRate(this.http_requests_metrics()));
	public readonly http_distribution = computed(() => computeEndpointDistribution(this.http_requests_metrics()));

	private subscriptions = new Subscription();
	private auto_refresh_subscription: Subscription | null = null;

	ngOnInit(): void {
		this.locale = this.settingDeviceService.getLocale();
		this.page_settings.set(this.getPageSettings());
		this.auth_supported.set(this.resolveAuthSupported());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.subscriptions.add(this.getAutoRefreshSubscription());
		this.orchardOptionalInit();
		this.loadMetrics();
	}

	/** Flags whether the mint advertises auth (NUT-21 clear or NUT-22 blind) from resolved mint info */
	private resolveAuthSupported(): boolean {
		const mint_info = this.route.snapshot.data['mint_info'] as MintInfo | null;
		return !!(mint_info?.nuts?.nut21 || mint_info?.nuts?.nut22);
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
		return resolveSystemMetricsSettings(this.settingDeviceService.getMintSystemSettings());
	}

	private updateSettings(settings: NonNullableSystemMetricsSettings): void {
		this.page_settings.set(settings);
		this.settingDeviceService.setMintSystemSettings(settings);
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

	/** Ticks every minute; each tick decides whether a live minute window is active */
	private getAutoRefreshSubscription(): Subscription {
		return timer(60000, 60000).subscribe(() => this.autoRefreshMetrics());
	}

	/* *******************************************************
		Data
	******************************************************** */

	/** Loads the stored metric series for the selected range and interval */
	private loadMetrics(): void {
		const settings = this.page_settings();
		if (!settings) return;
		this.auto_refresh_subscription?.unsubscribe();
		this.loading_metrics.set(true);
		this.subscriptions.add(
			this.mintService
				.loadMintMetrics({
					date_start: settings.date_start,
					date_end: settings.date_end,
					interval: settings.interval,
					timezone: this.settingDeviceService.getTimezone(),
					metrics: this.getMetricFamilies(),
				})
				.subscribe({
					next: (metrics: MintMetric[]) => {
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

	private filterMetrics(metric: string): MintMetric[] {
		return this.metrics().filter((m) => m.metric === metric);
	}

	/** Metric families to request, including auth series only when the mint advertises auth */
	private getMetricFamilies(): string[] {
		return this.auth_supported() ? [...CHART_METRIC_FAMILIES, ...AUTH_METRIC_FAMILIES] : CHART_METRIC_FAMILIES;
	}

	/** Rolls the window forward and silently refetches without touching loading state */
	private autoRefreshMetrics(): void {
		const settings = this.page_settings();
		if (!shouldAutoRefreshMetrics(settings) || this.loading_metrics() || this.refreshing() || document.hidden) return;
		const refreshed_settings = refreshMetricsRange(settings!);
		this.page_settings.set(refreshed_settings);
		this.settingDeviceService.setMintSystemSettings(refreshed_settings);
		this.auto_refresh_subscription?.unsubscribe();
		this.auto_refresh_subscription = this.mintService
			.loadMintMetrics({
				date_start: refreshed_settings.date_start,
				date_end: refreshed_settings.date_end,
				interval: refreshed_settings.interval,
				timezone: this.settingDeviceService.getTimezone(),
				metrics: this.getMetricFamilies(),
			})
			.subscribe({
				next: (metrics: MintMetric[]) => this.metrics.set(metrics),
				// silent tick: keep the last data and let the timer retry next minute
				error: () => {},
			});
	}

	/** Forces a fresh fetch of the stored series against a re-resolved rolling window, then pulses the page */
	public onRefresh(): void {
		const settings = this.page_settings();
		if (!settings || this.refreshing()) return;
		this.auto_refresh_subscription?.unsubscribe();
		const refreshed_settings = refreshMetricsRange(settings);
		this.page_settings.set(refreshed_settings);
		this.settingDeviceService.setMintSystemSettings(refreshed_settings);
		this.refreshing.set(true);
		this.loading_metrics.set(true);
		this.mintService.clearMetricsCache();
		this.subscriptions.add(
			this.mintService
				.loadMintMetrics({
					date_start: refreshed_settings.date_start,
					date_end: refreshed_settings.date_end,
					interval: refreshed_settings.interval,
					timezone: this.settingDeviceService.getTimezone(),
					metrics: this.getMetricFamilies(),
				})
				.subscribe({
					next: (metrics: MintMetric[]) => {
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
		const resolved_dates = resolveMetricsDateRangePreset(preset);
		const interval = suggestMetricsInterval(preset) ?? settings.interval;
		this.updateSettings({
			...settings,
			date_start: resolved_dates.date_start,
			date_end: resolved_dates.date_end,
			date_preset: preset,
			interval,
		});
	}

	public onIntervalChange(interval: SystemMetricsInterval): void {
		const settings = this.page_settings();
		if (!settings) return;
		this.updateSettings(refreshMetricsRange({...settings, interval}));
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.auto_refresh_subscription?.unsubscribe();
		this.subscriptions.unsubscribe();
	}
}
