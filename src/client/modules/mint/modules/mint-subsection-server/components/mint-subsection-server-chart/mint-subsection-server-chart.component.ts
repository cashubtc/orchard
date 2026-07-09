/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, OnChanges, OnDestroy, SimpleChanges, computed, signal, viewChild} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartType as ChartJsType, Plugin} from 'chart.js';
import {DateTime} from 'luxon';
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
/* Native Dependencies */
import {MintMetric} from '@client/modules/mint/classes/mint-metric.class';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

export type MintServerChartUnit = 'count' | 'percent' | 'bytes' | 'seconds';

@Component({
	selector: 'orc-mint-subsection-server-chart',
	standalone: false,
	templateUrl: './mint-subsection-server-chart.component.html',
	styleUrl: './mint-subsection-server-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionServerChartComponent implements OnChanges, OnDestroy {
	public readonly chart = viewChild(BaseChartDirective);

	public locale = input.required<string>();
	public metrics = input.required<MintMetric[]>();
	public interval = input.required<SystemMetricsInterval>();
	public unit = input.required<MintServerChartUnit>();
	public type = input.required<'line' | 'bar'>();
	public stacked = input<boolean>(false);
	public color_index = input<number>(0);
	public percentiles = input<boolean>(false);
	public legend = input<'below' | 'none'>('none');
	public loading = input.required<boolean>();

	public chart_type!: ChartJsType;
	public chart_data: ChartConfiguration['data'] = {datasets: []};
	public chart_options: ChartConfiguration['options'] = {};
	public chart_plugins: Plugin[] = [];
	public readonly displayed = signal<boolean>(true);

	public readonly has_data = computed(() => this.metrics().length > 0);

	private subscriptions: Subscription = new Subscription();

	constructor(private chartService: ChartService) {
		this.subscriptions.add(this.chartService.onResizeStart().subscribe(() => this.displayed.set(false)));
		this.subscriptions.add(this.chartService.onResizeEnd().subscribe(() => this.displayed.set(true)));
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['loading'] && this.loading() === false) this.init();
		if (changes['metrics'] && !changes['metrics'].firstChange) this.init();
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

	/** Groups metrics by label set into one themed dataset per series */
	private getChartData(): ChartConfiguration['data'] {
		const series_map = new Map<string, MintMetric[]>();
		for (const metric of this.metrics()) {
			const key = `${metric.metric}|${metric.labels.map((label) => `${label.name}=${label.value}`).join(',')}`;
			const series = series_map.get(key);
			if (series) series.push(metric);
			else series_map.set(key, [metric]);
		}

		if (this.percentiles()) return {datasets: this.getPercentileDatasets(series_map)};

		const is_line = this.type() === 'line';
		const datasets = Array.from(series_map.values()).map((series, index) => {
			const color = this.chartService.getCategoricalColor(this.color_index() + index);
			const muted_color = this.chartService.getMutedColor(color.border);
			return {
				data: series.map((metric) => ({x: metric.date * 1000, y: this.convertValue(metric.value ?? null)})),
				label: this.getSeriesLabel(series[0]),
				backgroundColor: is_line ? (context: any) => this.chartService.createAreaGradient(context, color.border) : muted_color,
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
	private getPercentileDatasets(series_map: Map<string, MintMetric[]>): ChartConfiguration['data']['datasets'] {
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
	private getChartPlugins(): Plugin[] {
		if (this.type() !== 'line') return [];
		const first_color = this.chart_data?.datasets?.[0]?.borderColor as string;
		return first_color ? [this.chartService.createGlowPlugin(first_color)] : [];
	}

	/** Derives a legend label from a series label set */
	private getSeriesLabel(metric: MintMetric): string {
		if (metric.labels.length === 0) return this.humanizeMetric(metric.metric);
		return metric.labels.map((label) => label.value).join(' · ');
	}

	/** Turns a prometheus family name into a readable single-series label */
	private humanizeMetric(metric: string): string {
		return metric
			.replace(/^(cdk|process)_/, '')
			.replace(/_(total|seconds|bytes|percent)$/, '')
			.replace(/_/g, ' ');
	}

	private getChartOptions(): ChartConfiguration['options'] {
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
					grid: {color: this.chartService.getGridColor()},
					ticks: {
						callback: (value: string | number) => this.formatValue(Number(value)),
					},
				},
			},
			plugins: {
				tooltip: {
					enabled: true,
					mode: 'index',
					intersect: false,
					callbacks: {
						title: (tooltip_items: any) => this.getTooltipTitle(tooltip_items),
						label: (context: any) => `${context.dataset.label}: ${this.formatValue(context.parsed.y)}`,
						labelColor: (context: any) => ({
							borderColor: context.dataset.borderColor,
							backgroundColor: context.dataset.borderColor,
							borderWidth: 2,
							borderRadius: 0,
						}),
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
			case 'bytes':
				return `${formatted} MB`;
			case 'seconds':
				return `${formatted} ms`;
			default:
				return formatted;
		}
	}

	private getTooltipTitle(tooltip_items: any): string {
		if (tooltip_items.length === 0) return '';
		return DateTime.fromMillis(tooltip_items[0].parsed.x).toLocaleString({
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
