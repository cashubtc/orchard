/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	input,
	OnChanges,
	OnDestroy,
	SimpleChanges,
	computed,
	inject,
	signal,
	viewChild,
} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, Plugin, ScriptableContext, TooltipItem} from 'chart.js';
import type {AnnotationPluginOptions} from 'chartjs-plugin-annotation';
import {DateTime} from 'luxon';
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
/* Native Dependencies */
import {SystemChartUnit, SystemChartPoint, SystemChartReferenceLine} from '@client/modules/system/types/system.types';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

type SystemChartJsType = 'line' | 'bar';

@Component({
	selector: 'orc-system-chart',
	standalone: false,
	templateUrl: './system-chart.component.html',
	styleUrl: './system-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemChartComponent implements OnChanges, OnDestroy {
	private readonly chartService = inject(ChartService);

	public readonly chart = viewChild(BaseChartDirective);

	public locale = input.required<string>();
	public metrics = input.required<SystemChartPoint[]>();
	public interval = input.required<SystemMetricsInterval>();
	public unit = input.required<SystemChartUnit>();
	public type = input<'line' | 'bar'>('line');
	public stacked = input<boolean>(false);
	public percentiles = input<boolean>(false);
	public color_index = input<number>(0);
	public legend = input<'below' | 'none'>('none');
	// Legend layout for non-percentile charts; percentile charts always use the matrix layout
	public legend_layout = input<'wrap' | 'list'>('wrap');
	// Header label above the series-name column in the matrix legend
	public legend_group_label = input<string>('series');
	public label_map = input<Record<string, string> | undefined>(undefined);
	public reference_line = input<SystemChartReferenceLine | undefined>(undefined);
	public ceiling = input<number | undefined>(undefined);
	public loading = input.required<boolean>();

	public chart_type!: SystemChartJsType;
	public chart_data: ChartConfiguration<SystemChartJsType>['data'] = {datasets: []};
	public chart_options: ChartConfiguration<SystemChartJsType>['options'] = {};
	public chart_plugins: Plugin<SystemChartJsType>[] = [];
	public readonly displayed = signal<boolean>(true);

	public readonly has_data = computed(() => this.metrics().length > 0);
	// Percentile charts always use the matrix layout; others honor the requested legend layout
	public readonly resolved_legend_layout = computed<'wrap' | 'list' | 'matrix'>(() =>
		this.percentiles() ? 'matrix' : this.legend_layout(),
	);

	private built_series_keys = '';

	private subscriptions: Subscription = new Subscription();

	constructor() {
		this.subscriptions.add(this.chartService.onResizeStart().subscribe(() => this.displayed.set(false)));
		this.subscriptions.add(this.chartService.onResizeEnd().subscribe(() => this.displayed.set(true)));
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['loading'] && this.loading() === false) this.init();
		if (changes['metrics'] && !changes['metrics'].firstChange) {
			const metrics_only = Object.keys(changes).length === 1;
			if (metrics_only && this.getMetricsSeriesKeys() === this.built_series_keys) this.quietUpdate();
			else this.init();
		}
		// Reference values arrive async from system_info, after the series has rendered
		if (
			(changes['reference_line'] && !changes['reference_line'].firstChange) ||
			(changes['ceiling'] && !changes['ceiling'].firstChange)
		)
			this.init();
	}

	/* *******************************************************
		Chart
	******************************************************** */

	/** Builds chart data and options from the metric series */
	private init(): void {
		this.chart_type = this.type();
		this.chart_data = this.getChartData();
		this.chart_options = this.getChartOptions();
		this.chart_plugins = this.getChartPlugins();
		setTimeout(() => {
			this.chart()?.chart?.resize();
		});
		setTimeout(() => {
			this.displayed.set(true);
		}, 50);
	}

	/** Replaces dataset data in place and redraws without animation (live tick) */
	private quietUpdate(): void {
		const chart = this.chart()?.chart;
		const next_data = this.getChartData();
		if (!chart || next_data.datasets.length !== this.chart_data.datasets.length) return this.init();
		next_data.datasets.forEach((dataset, index) => (this.chart_data.datasets[index].data = dataset.data));
		chart.update('none');
	}

	/** Stable identity for a metric series: family name plus its prometheus label set */
	private getSeriesKey(metric: SystemChartPoint): string {
		return `${metric.metric}|${(metric.labels ?? []).map((label) => `${label.name}=${label.value}`).join(',')}`;
	}

	/** Ordered unique series keys of the current metrics input */
	private getMetricsSeriesKeys(): string {
		return Array.from(new Set(this.metrics().map((metric) => this.getSeriesKey(metric)))).join(';');
	}

	/** Groups metrics by label set into one themed dataset per series */
	private getChartData(): ChartConfiguration<SystemChartJsType>['data'] {
		const series_map = new Map<string, SystemChartPoint[]>();
		for (const metric of this.metrics()) {
			const key = this.getSeriesKey(metric);
			const series = series_map.get(key);
			if (series) series.push(metric);
			else series_map.set(key, [metric]);
		}
		this.built_series_keys = Array.from(series_map.keys()).join(';');

		if (this.percentiles()) return {datasets: this.getPercentileDatasets(series_map)};

		const is_line = this.type() === 'line';
		const datasets = Array.from(series_map.values()).map((series, index) => {
			const color = this.chartService.getCategoricalColor(this.color_index() + index);
			const muted_color = this.chartService.getMutedColor(color.border);
			return {
				data: series.map((metric) => ({x: metric.date * 1000, y: this.convertValue(metric.value ?? null)})),
				label: this.getSeriesLabel(series[0]),
				backgroundColor: is_line
					? (context: ScriptableContext<SystemChartJsType>) => this.chartService.createAreaGradient(context, color.border)
					: muted_color,
				borderColor: muted_color,
				borderWidth: is_line ? 2 : 0,
				borderRadius: 0,
				pointBackgroundColor: muted_color,
				pointBorderColor: muted_color,
				pointBorderWidth: 2,
				pointHoverBackgroundColor: this.chartService.getPointHoverBackgroundColor(),
				pointHoverBorderColor: color.border,
				pointHoverBorderWidth: 3,
				pointRadius: 0,
				pointHoverRadius: 4,
				fill: is_line,
				tension: 0.4,
				spanGaps: true,
			};
		});

		return {datasets};
	}

	/** Builds three line datasets (p50/p95/p99) per series: color by series, line style by percentile */
	private getPercentileDatasets(series_map: Map<string, SystemChartPoint[]>): ChartConfiguration<SystemChartJsType>['data']['datasets'] {
		const percentile_configs: {key: 'p50' | 'p95' | 'p99'; label: string; dash: number[]}[] = [
			{key: 'p50', label: 'p50', dash: [4, 4]},
			{key: 'p95', label: 'p95', dash: []},
			{key: 'p99', label: 'p99', dash: [1, 3]},
		];

		return Array.from(series_map.values()).flatMap((series, series_index) => {
			const color = this.chartService.getCategoricalColor(this.color_index() + series_index);
			const muted_color = this.chartService.getMutedColor(color.border);
			return percentile_configs.map((config) => ({
				data: series.map((metric) => ({x: metric.date * 1000, y: this.convertValue(metric[config.key] ?? null)})),
				label: `${this.getSeriesLabel(series[0])} · ${config.label}`,
				borderColor: muted_color,
				borderWidth: 2,
				borderDash: config.dash,
				backgroundColor: muted_color,
				pointBackgroundColor: muted_color,
				pointBorderColor: muted_color,
				pointBorderWidth: 2,
				pointHoverBackgroundColor: this.chartService.getPointHoverBackgroundColor(),
				pointHoverBorderColor: color.border,
				pointHoverBorderWidth: 3,
				pointRadius: 0,
				pointHoverRadius: 4,
				fill: false,
				tension: 0.4,
				spanGaps: true,
			}));
		});
	}

	/** Line charts get the shared point-glow plugin, matching the dashboard */
	private getChartPlugins(): Plugin<SystemChartJsType>[] {
		if (this.type() !== 'line') return [];
		const first_color = this.chart_data?.datasets?.[0]?.borderColor as string;
		return first_color ? [this.chartService.createGlowPlugin(first_color)] : [];
	}

	/**
	 * Derives a legend label for a series: an explicit label_map entry wins, then a
	 * prometheus-labels-derived label, then a humanized metric-name fallback.
	 */
	private getSeriesLabel(metric: SystemChartPoint): string {
		const mapped = this.label_map()?.[metric.metric];
		if (mapped) return mapped;
		const labels = metric.labels ?? [];
		if (labels.length > 0) return labels.map((label) => label.value).join(' · ');
		return this.humanizeMetric(metric.metric);
	}

	/** Turns a prometheus family name into a readable single-series label */
	private humanizeMetric(metric: string): string {
		return metric
			.replace(/^(cdk|process)_/, '')
			.replace(/_(total|seconds|bytes|percent)$/, '')
			.replace(/_/g, ' ');
	}

	/** Builds responsive axes, tooltips, interactions, and optional annotations for the chart. */
	private getChartOptions(): ChartConfiguration<SystemChartJsType>['options'] {
		return {
			responsive: true,
			maintainAspectRatio: false,
			elements: {
				line: {
					tension: 0.5,
					cubicInterpolationMode: 'monotone',
				},
			},
			scales: {
				x: {
					type: 'time',
					stacked: this.stacked(),
					time: {
						unit: this.getTimeUnit(),
					},
					adapters: {date: {locale: this.locale()}},
					grid: {display: false},
				},
				y: {
					stacked: this.stacked(),
					beginAtZero: true,
					// 2% headroom keeps the ceiling annotation clear of the chart edge
					suggestedMax: this.ceiling() !== undefined ? this.ceiling()! * 1.02 : undefined,
					grid: {color: this.chartService.getGridColor()},
					ticks: {
						callback: (value: string | number) => this.formatValue(Number(value)),
					},
				},
			},
			plugins: {
				...(this.reference_line() ? {annotation: this.getReferenceAnnotation()} : {}),
				tooltip: {
					enabled: true,
					mode: 'index',
					intersect: false,
					callbacks: {
						title: (tooltip_items) => this.getTooltipTitle(tooltip_items),
						label: (context) =>
							`${context.dataset.label}: ${context.parsed.y === null ? '—' : this.formatValue(context.parsed.y)}`,
						labelColor: (context) => {
							const border_color =
								typeof context.dataset.borderColor === 'string' ? context.dataset.borderColor : 'transparent';
							return {
								borderColor: border_color,
								backgroundColor: border_color,
								borderWidth: 2,
								borderRadius: 0,
							};
						},
					},
				},
				legend: {
					display: false,
				},
			},
			interaction: {
				mode: 'index',
				axis: 'x',
				intersect: false,
			},
		};
	}

	/** Builds a dashed horizontal annotation line at the reference value */
	private getReferenceAnnotation(): AnnotationPluginOptions {
		const reference = this.reference_line()!;
		const config = this.chartService.getFormAnnotationConfig(false);
		return {
			annotations: {
				reference: {
					type: 'line',
					borderColor: config.border_color,
					borderWidth: config.border_width,
					borderDash: [4, 4],
					display: true,
					label: {
						display: true,
						content: reference.label,
						position: 'end',
						backgroundColor: config.label_bg_color,
						color: config.text_color,
						font: {
							size: 12,
							weight: 300,
						},
						borderColor: config.label_border_color,
						borderWidth: 1,
					},
					scaleID: 'y',
					value: reference.value,
				},
			},
		};
	}

	/** Maps the aggregation interval to a chart.js time unit */
	private getTimeUnit(): 'minute' | 'hour' | 'day' {
		switch (this.interval()) {
			case SystemMetricsInterval.Minute:
				return 'minute';
			case SystemMetricsInterval.Hour:
				return 'hour';
			default:
				return 'day';
		}
	}

	/** Converts raw values into display units (bytes to MB, seconds to ms) */
	private convertValue(value: number | null): number | null {
		if (value === null) return null;
		if (this.unit() === 'bytes') return value / (1024 * 1024);
		if (this.unit() === 'seconds') return value * 1000;
		return value;
	}

	/** Formats a converted value with its display unit suffix */
	public formatValue(value: number): string {
		const formatted = new Intl.NumberFormat(this.locale(), {maximumFractionDigits: 2}).format(value);
		switch (this.unit()) {
			case 'percent':
				return `${formatted}%`;
			case 'megabytes':
			case 'bytes':
				return `${formatted} MB`;
			case 'seconds':
				return `${formatted} ms`;
			default:
				return formatted;
		}
	}

	/**
	 * Formats the timestamp shared by the hovered chart points.
	 * @param {TooltipItem<SystemChartJsType>[]} tooltip_items - Chart.js tooltip entries at the active x-coordinate.
	 * @returns {string} Localized tooltip timestamp, or an empty string when no point is active.
	 */
	private getTooltipTitle(tooltip_items: TooltipItem<SystemChartJsType>[]): string {
		const timestamp = tooltip_items[0]?.parsed.x;
		if (timestamp === null || timestamp === undefined) return '';
		return DateTime.fromMillis(timestamp).toLocaleString({
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
		});
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
