/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnInit, OnDestroy, computed, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
import {EMPTY, Subscription, catchError, forkJoin, of, timer, switchMap, takeWhile} from 'rxjs';
/* Application Dependencies */
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {NonNullableMintServerSettings} from '@client/modules/settings/types/setting.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {resolveDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Native Dependencies */
import {MintMetric, MintMetricSnapshot} from '@client/modules/mint/classes/mint-metric.class';
/* Shared Dependencies */
import {MintMetricsInterval} from '@shared/generated.types';

const SNAPSHOT_POLL_INTERVAL_MS = 30000;
const METRICS_RETENTION_DAYS = 90;
const DATA_PULSE_DURATION_MS = 700;
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
];

@Component({
	selector: 'orc-mint-subsection-server',
	standalone: false,
	templateUrl: './mint-subsection-server.component.html',
	styleUrl: './mint-subsection-server.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionServerComponent implements OnInit, OnDestroy {
	private readonly route = inject(ActivatedRoute);
	private readonly mintService = inject(MintService);
	private readonly settingDeviceService = inject(SettingDeviceService);
	private readonly breakpointObserver = inject(BreakpointObserver);

	public locale!: string;

	public readonly page_settings = signal<NonNullableMintServerSettings | null>(null);
	public readonly snapshots = signal<MintMetricSnapshot[]>([]);
	public readonly metrics = signal<MintMetric[]>([]);
	public readonly loading_metrics = signal<boolean>(true);
	public readonly refreshing = signal<boolean>(false);
	public readonly pulsing = signal<boolean>(false);
	public readonly device_type = signal<DeviceType>('desktop');

	public readonly operations_metrics = computed(() => this.filterMetrics('cdk_mint_operations_total'));
	public readonly operation_duration_metrics = computed(() => this.filterMetrics('cdk_mint_operation_duration_seconds'));
	public readonly http_requests_metrics = computed(() => this.filterMetrics('cdk_http_requests_total'));
	public readonly http_duration_metrics = computed(() => this.filterMetrics('cdk_http_request_duration_seconds'));
	public readonly db_operations_metrics = computed(() => this.filterMetrics('cdk_db_operations_total'));
	public readonly db_duration_metrics = computed(() => this.filterMetrics('cdk_db_operation_duration_seconds'));
	public readonly errors_metrics = computed(() => this.filterMetrics('cdk_errors_total'));
	public readonly cpu_metrics = computed(() => this.filterMetrics('process_cpu_usage_percent'));
	public readonly memory_metrics = computed(() => this.filterMetrics('process_memory_bytes'));

	private polling_active = true;
	private pulse_timeout: ReturnType<typeof setTimeout> | null = null;
	private subscriptions = new Subscription();

	ngOnInit(): void {
		this.locale = this.settingDeviceService.getLocale();
		this.snapshots.set(this.route.snapshot.data['mint_metrics_snapshot'] ?? []);
		this.page_settings.set(this.getPageSettings());
		this.subscriptions.add(this.getBreakpointSubscription());
		this.subscriptions.add(this.getSnapshotPollingSubscription());
		this.loadMetrics();
	}

	/* *******************************************************
		Settings
	******************************************************** */

	/** Builds page settings from device settings with defaults for first visits */
	private getPageSettings(): NonNullableMintServerSettings {
		const settings = this.settingDeviceService.getMintServerSettings();
		const date_preset = settings.date_preset ?? null;
		const resolved_dates = date_preset ? resolveDateRangePreset(date_preset, this.getMetricsGenesisTime()) : null;
		return {
			date_start: resolved_dates?.date_start ?? settings.date_start ?? this.getDefaultDateStart(),
			date_end: resolved_dates?.date_end ?? settings.date_end ?? this.getDefaultDateEnd(),
			date_preset,
			interval: settings.interval ?? MintMetricsInterval.Hour,
		};
	}

	/** Oldest possible sample given the server retention window (used for the AllTime preset) */
	private getMetricsGenesisTime(): number {
		return Math.floor(DateTime.now().minus({days: METRICS_RETENTION_DAYS}).startOf('day').toSeconds());
	}

	private getDefaultDateStart(): number {
		return Math.floor(DateTime.now().minus({days: 7}).startOf('day').toSeconds());
	}

	private getDefaultDateEnd(): number {
		return Math.floor(DateTime.now().endOf('day').toSeconds());
	}

	private updateSettings(settings: NonNullableMintServerSettings): void {
		this.page_settings.set(settings);
		this.settingDeviceService.setMintServerSettings(settings);
		this.loadMetrics();
	}

	/* *******************************************************
		Subscriptions
	******************************************************** */

	/** Polls the live metrics snapshot; stops polling if the endpoint becomes unreachable */
	private getSnapshotPollingSubscription(): Subscription {
		return timer(SNAPSHOT_POLL_INTERVAL_MS, SNAPSHOT_POLL_INTERVAL_MS)
			.pipe(
				takeWhile(() => this.polling_active),
				switchMap(() =>
					this.mintService.getMintMetricsSnapshot().pipe(
						catchError((error) => {
							console.error('Failed to fetch mint metrics snapshot, polling stopped:', error);
							this.polling_active = false;
							return EMPTY;
						}),
					),
				),
			)
			.subscribe((snapshots: MintMetricSnapshot[]) => {
				this.snapshots.set(snapshots);
			});
	}

	private getBreakpointSubscription(): Subscription {
		return this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium]).subscribe((result) => {
			if (result.breakpoints[Breakpoints.XSmall]) {
				this.device_type.set('mobile');
			} else if (result.breakpoints[Breakpoints.Small] || result.breakpoints[Breakpoints.Medium]) {
				this.device_type.set('tablet');
			} else {
				this.device_type.set('desktop');
			}
		});
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
			this.mintService
				.loadMintMetrics({
					date_start: settings.date_start,
					date_end: settings.date_end,
					interval: settings.interval,
					timezone: this.settingDeviceService.getTimezone(),
					metrics: CHART_METRIC_FAMILIES,
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

	/** Forces a fresh fetch of both the stored series and the live snapshot, then pulses the page */
	public onRefresh(): void {
		const settings = this.page_settings();
		if (!settings || this.refreshing()) return;
		this.refreshing.set(true);
		this.loading_metrics.set(true);
		this.mintService.clearMetricsCache();
		this.subscriptions.add(
			forkJoin({
				metrics: this.mintService.loadMintMetrics({
					date_start: settings.date_start,
					date_end: settings.date_end,
					interval: settings.interval,
					timezone: this.settingDeviceService.getTimezone(),
					metrics: CHART_METRIC_FAMILIES,
				}),
				snapshot: this.mintService.getMintMetricsSnapshot().pipe(catchError(() => of(null))),
			}).subscribe({
				next: ({metrics, snapshot}) => {
					this.metrics.set(metrics);
					if (snapshot) this.snapshots.set(snapshot);
					this.loading_metrics.set(false);
					this.refreshing.set(false);
					this.triggerPulse();
				},
				error: () => {
					this.loading_metrics.set(false);
					this.refreshing.set(false);
				},
			}),
		);
	}

	/** Flashes the data-updated overlay on charts and cards, re-firing on every refresh */
	private triggerPulse(): void {
		if (this.pulse_timeout) clearTimeout(this.pulse_timeout);
		this.pulsing.set(false);
		this.pulsing.set(true);
		this.pulse_timeout = setTimeout(() => this.pulsing.set(false), DATA_PULSE_DURATION_MS);
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
		const resolved_dates = resolveDateRangePreset(preset, this.getMetricsGenesisTime());
		this.updateSettings({...settings, date_start: resolved_dates.date_start, date_end: resolved_dates.date_end, date_preset: preset});
	}

	public onIntervalChange(interval: MintMetricsInterval): void {
		const settings = this.page_settings();
		if (!settings) return;
		this.updateSettings({...settings, interval});
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.polling_active = false;
		if (this.pulse_timeout) clearTimeout(this.pulse_timeout);
		this.subscriptions.unsubscribe();
	}
}
