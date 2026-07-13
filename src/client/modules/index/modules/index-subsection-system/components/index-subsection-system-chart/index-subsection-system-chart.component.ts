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
import {ChartConfiguration, ChartType as ChartJsType, Plugin} from 'chart.js';
import {DateTime} from 'luxon';
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
/* Native Dependencies */
import {SystemMetricSample} from '@client/modules/index/classes/system-metric.class';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

export type SystemChartUnit = 'count' | 'percent' | 'megabytes';

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
	selector: 'orc-index-subsection-system-chart',
	standalone: false,
	templateUrl: './index-subsection-system-chart.component.html',
	styleUrl: './index-subsection-system-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexSubsectionSystemChartComponent implements OnChanges, OnDestroy {
	private readonly chartService = inject(ChartService);

	public readonly chart = viewChild(BaseChartDirective);

	public locale = input.required<string>();
	public metrics = input.required<SystemMetricSample[]>();
	public interval = input.required<SystemMetricsInterval>();
	public unit = input.required<SystemChartUnit>();
	public type = input<'line' | 'bar'>('line');
	public color_index = input<number>(0);
	public legend = input<'below' | 'none'>('none');
	public loading = input.required<boolean>();

	public chart_type!: ChartJsType;
	public chart_data: ChartConfiguration['data'] = {datasets: []};
	public chart_options: ChartConfiguration['options'] = {};
	public chart_plugins: Plugin[] = [];
	public readonly displayed = signal<boolean>(true);

	public readonly has_data = computed(() => this.metrics().length > 0);

	private subscriptions: Subscription = new Subscription();

	constructor() {
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

	/** Groups metrics by name into one themed dataset per metric series */
	private getChartData(): ChartConfiguration['data'] {
		const series_map = new Map<string, SystemMetricSample[]>();
		for (const metric of this.metrics()) {
			const series = series_map.get(metric.metric);
			if (series) series.push(metric);
			else series_map.set(metric.metric, [metric]);
		}

		const is_line = this.type() === 'line';
		const datasets = Array.from(series_map.entries()).map(([name, series], index) => {
			const color = this.chartService.getCategoricalColor(this.color_index() + index);
			const muted_color = this.chartService.getMutedColor(color.border);
			return {
				data: series.map((metric) => ({x: metric.date * 1000, y: metric.value ?? null})),
				label: this.humanizeMetric(name),
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

	/** Line charts get the shared point-glow plugin, matching the dashboard */
	private getChartPlugins(): Plugin[] {
		if (this.type() !== 'line') return [];
		const first_color = this.chart_data?.datasets?.[0]?.borderColor as string;
		return first_color ? [this.chartService.createGlowPlugin(first_color)] : [];
	}

	/** Turns a metric key into a readable series label */
	private humanizeMetric(metric: string): string {
		return METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ');
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
					time: {
						unit: this.getTimeUnit(),
					},
					adapters: {date: {locale: this.locale()}},
					grid: {display: false},
				},
				y: {
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

	/** Formats a value with its display unit suffix */
	public formatValue(value: number): string {
		const formatted = new Intl.NumberFormat(this.locale(), {maximumFractionDigits: 2}).format(value);
		switch (this.unit()) {
			case 'percent':
				return `${formatted}%`;
			case 'megabytes':
				return `${formatted} MB`;
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
