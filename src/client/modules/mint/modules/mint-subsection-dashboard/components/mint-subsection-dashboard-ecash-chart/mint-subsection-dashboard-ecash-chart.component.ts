/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, OnDestroy, OnChanges, SimpleChanges, ViewChild, signal, computed} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ScaleChartOptions, ChartType as ChartJsType, Plugin} from 'chart.js';
import {DateTime} from 'luxon';
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {NonNullableMintDashboardSettings} from '@client/modules/settings/types/setting.types';
import {
	type AnalyticsGroup,
	groupAnalyticsByUnit,
	prependData,
	getDataKeyedByTimestamp,
	getCountData,
	getAllPossibleTimestamps,
	getTimeInterval,
} from '@client/modules/chart/helpers/mint-chart-data.helpers';
import {getXAxisConfig, getTooltipTitle, formatAxisValue} from '@client/modules/chart/helpers/mint-chart-options.helpers';
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintAnalytic} from '@client/modules/mint/classes/mint-analytic.class';
import {ChartType} from '@client/modules/mint/enums/chart-type.enum';

@Component({
	selector: 'orc-mint-subsection-dashboard-ecash-chart',
	standalone: false,
	templateUrl: './mint-subsection-dashboard-ecash-chart.component.html',
	styleUrl: './mint-subsection-dashboard-ecash-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDashboardEcashChartComponent implements OnDestroy, OnChanges {
	@ViewChild(BaseChartDirective) chart?: BaseChartDirective;

	public locale = input.required<string>();
	public mint_analytics_proofs = input.required<MintAnalytic[]>();
	public mint_analytics_proofs_pre = input.required<MintAnalytic[]>();
	public mint_analytics_promises = input.required<MintAnalytic[]>();
	public mint_analytics_promises_pre = input.required<MintAnalytic[]>();
	public page_settings = input.required<NonNullableMintDashboardSettings>();
	public mint_genesis_time = input.required<number>();
	public selected_type = input.required<ChartType | null | undefined>();
	public loading = input.required<boolean>();
	public device_mobile = input.required<boolean>();

	public readonly mint_keysets = input<MintKeyset[]>([]);

	public chart_type!: ChartJsType;
	public chart_data = signal<ChartConfiguration['data']>({datasets: []});
	public chart_options!: ChartConfiguration['options'];
	public chart_plugins: Plugin[] = [];
	public displayed = signal<boolean>(true);
	public hidden_datasets = signal<Set<number>>(new Set());

	public proof_datasets = computed(
		() =>
			this.chart_data()
				.datasets?.map((d, i) => ({...d, _index: i}))
				.filter((d) => (d as any)._type === 'proof') ?? [],
	);
	public promise_datasets = computed(
		() =>
			this.chart_data()
				.datasets?.map((d, i) => ({...d, _index: i}))
				.filter((d) => (d as any)._type === 'promise') ?? [],
	);

	private subscriptions: Subscription = new Subscription();

	constructor(private chartService: ChartService) {
		this.subscriptions.add(this.getRemoveSubscription());
		this.subscriptions.add(this.getAddSubscription());
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['loading'] && !changes['loading'].firstChange) {
			if (this.loading() === false) this.init();
		}
		if (changes['selected_type'] && !changes['selected_type'].firstChange) {
			this.init();
		}
	}

	/* *******************************************************
		Initialization
	******************************************************** */

	private getRemoveSubscription(): Subscription {
		return this.chartService.onResizeStart().subscribe(() => {
			this.displayed.set(false);
		});
	}

	private getAddSubscription(): Subscription {
		return this.chartService.onResizeEnd().subscribe(() => {
			this.displayed.set(true);
		});
	}

	private init(): void {
		const has_proofs = this.mint_analytics_proofs().length > 0 || this.mint_analytics_proofs_pre().length > 0;
		const has_promises = this.mint_analytics_promises().length > 0 || this.mint_analytics_promises_pre().length > 0;
		if (!has_proofs && !has_promises) return;

		switch (this.selected_type()) {
			case ChartType.Totals:
				this.chart_type = 'line';
				this.chart_data.set(this.getEcashTotalsData());
				this.chart_options = this.getEcashChartOptions();
				this.initGlowPlugin();
				break;
			case ChartType.Volume:
				this.chart_type = 'bar';
				this.chart_data.set(this.getEcashVolumeData());
				this.chart_options = this.getEcashChartOptions();
				this.chart_plugins = [];
				break;
		}

		if (this.chart_options?.plugins) this.chart_options.plugins.annotation = this.getAnnotations();
		setTimeout(() => {
			this.chart?.chart?.resize();
			this.applyHiddenDatasets();
		});
		setTimeout(() => {
			this.displayed.set(true);
		}, 50);
	}

	/** Creates the glow effect plugin for chart points (line charts only) */
	private initGlowPlugin(): void {
		const data = this.chart_data();
		if (!data?.datasets || data.datasets.length === 0) {
			this.chart_plugins = [];
			return;
		}
		const first_color = data.datasets[0]?.borderColor as string;
		this.chart_plugins = first_color ? [this.chartService.createGlowPlugin(first_color)] : [];
	}

	/* *******************************************************
		Data
	******************************************************** */

	/** Gets the ecash totals (cumulative stacked area) chart data */
	private getEcashTotalsData(): ChartConfiguration['data'] {
		if (!this.page_settings()) return {datasets: []};

		const time_interval = getTimeInterval(this.page_settings().interval);
		const timestamp_first = DateTime.fromSeconds(this.page_settings().date_start).startOf(time_interval).toSeconds();
		const timestamp_last = DateTime.fromSeconds(this.page_settings().date_end).startOf(time_interval).toSeconds();
		const timestamp_range = getAllPossibleTimestamps(timestamp_first, timestamp_last, this.page_settings().interval);

		const proofs_groups = groupAnalyticsByUnit(this.mint_analytics_proofs().map((a) => ({...a})));
		const proofs_prepended = prependData(
			proofs_groups,
			this.mint_analytics_proofs_pre().map((a) => ({...a})),
			timestamp_first,
		);

		const promises_groups = groupAnalyticsByUnit(this.mint_analytics_promises().map((a) => ({...a})));
		const promises_prepended = prependData(
			promises_groups,
			this.mint_analytics_promises_pre().map((a) => ({...a})),
			timestamp_first,
		);

		return {datasets: this.buildDatasets(timestamp_range, proofs_prepended, promises_prepended, true)};
	}

	/** Gets the ecash volume (stacked bar) chart data */
	private getEcashVolumeData(): ChartConfiguration['data'] {
		if (!this.page_settings()) return {datasets: []};

		const time_interval = getTimeInterval(this.page_settings().interval);
		const timestamp_first = DateTime.fromSeconds(this.page_settings().date_start).startOf(time_interval).toSeconds();
		const timestamp_last = DateTime.fromSeconds(this.page_settings().date_end).startOf(time_interval).toSeconds();
		const timestamp_range = getAllPossibleTimestamps(timestamp_first, timestamp_last, this.page_settings().interval);

		const proofs_groups = groupAnalyticsByUnit(this.mint_analytics_proofs().map((a) => ({...a})));
		const promises_groups = groupAnalyticsByUnit(this.mint_analytics_promises().map((a) => ({...a})));

		return {datasets: this.buildDatasets(timestamp_range, proofs_groups, promises_groups, false)};
	}

	/** Builds chart datasets for both proofs and promises grouped by unit */
	private buildDatasets(
		timestamp_range: number[],
		proofs_by_unit: AnalyticsGroup,
		promises_by_unit: AnalyticsGroup,
		cumulative: boolean,
	): any[] {
		const datasets: any[] = [];
		const all_units = [...new Set([...Object.keys(proofs_by_unit), ...Object.keys(promises_by_unit)])];
		const is_line = cumulative;

		// Promises (blind sigs) first — they sit at the bottom of the stack
		for (const unit of all_units) {
			if (promises_by_unit[unit]) {
				const color = this.chartService.getAssetColor(
					unit,
					this.mint_keysets().map((keyset) => keyset.unit),
				);
				const muted_color = this.chartService.getMutedColor(color.border);
				const data_keyed = getDataKeyedByTimestamp(promises_by_unit[unit], 'count');
				const chart_data = getCountData(timestamp_range, data_keyed, cumulative);
				const fill: string | boolean = datasets.length === 0 ? 'origin' : '-1';
				datasets.push(
					is_line
						? this.buildLinePromiseDataset(chart_data, unit, color, muted_color, fill)
						: this.buildBarPromiseDataset(chart_data, unit, color),
				);
			}
		}

		// Proofs second — they sit on top of the stack
		for (const unit of all_units) {
			if (proofs_by_unit[unit]) {
				const color = this.chartService.getAssetColor(
					unit,
					this.mint_keysets().map((keyset) => keyset.unit),
				);
				const muted_color = this.chartService.getMutedColor(color.border);
				const data_keyed = getDataKeyedByTimestamp(proofs_by_unit[unit], 'count');
				const chart_data = getCountData(timestamp_range, data_keyed, cumulative);
				const fill: string | boolean = datasets.length === 0 ? 'origin' : '-1';
				datasets.push(
					is_line
						? this.buildLineTotalsDataset(chart_data, unit, 'proof', color, muted_color, fill)
						: this.buildBarVolumeDataset(chart_data, unit, 'proof', color),
				);
			}
		}

		return datasets;
	}

	/** Builds a dashed area line dataset for proofs (totals mode) */
	private buildLineTotalsDataset(
		data: {x: number; y: number}[],
		unit: string,
		type: string,
		color: {bg: string; border: string},
		muted_color: string,
		fill: string | boolean,
	): any {
		return {
			data,
			label: unit.toUpperCase(),
			_type: type,
			_unit: unit,
			stack: 'counts',
			backgroundColor: (context: any) => this.chartService.createAreaGradient(context, color.border, 0.01, 0.1),
			borderColor: muted_color,
			borderWidth: 2,
			borderDash: [6, 4],
			borderRadius: 0,
			pointBackgroundColor: muted_color,
			pointBorderColor: muted_color,
			pointBorderWidth: 2,
			pointHoverBackgroundColor: this.chartService.getPointHoverBackgroundColor(),
			pointHoverBorderColor: color.border,
			pointHoverBorderWidth: 3,
			pointRadius: 0,
			pointHoverRadius: 4,
			fill,
			tension: 0.4,
			yAxisID: 'y',
		};
	}

	/** Builds a solid area line dataset for promises (totals mode) */
	private buildLinePromiseDataset(
		data: {x: number; y: number}[],
		unit: string,
		color: {bg: string; border: string},
		muted_color: string,
		fill: string | boolean,
	): any {
		return {
			data,
			label: unit.toUpperCase(),
			_type: 'promise',
			_unit: unit,
			stack: 'counts',
			backgroundColor: (context: any) => this.chartService.createAreaGradient(context, color.border),
			borderColor: muted_color,
			borderWidth: 2,
			borderRadius: 0,
			pointBackgroundColor: muted_color,
			pointBorderColor: muted_color,
			pointBorderWidth: 2,
			pointHoverBackgroundColor: this.chartService.getPointHoverBackgroundColor(),
			pointHoverBorderColor: color.border,
			pointHoverBorderWidth: 3,
			pointRadius: 0,
			pointHoverRadius: 4,
			fill,
			tension: 0.4,
			yAxisID: 'y',
		};
	}

	/** Builds a striped bar dataset for proofs (volume mode) */
	private buildBarVolumeDataset(data: {x: number; y: number}[], unit: string, type: string, color: {bg: string; border: string}): any {
		return {
			data,
			label: unit.toUpperCase(),
			_type: type,
			_unit: unit,
			stack: 'counts',
			backgroundColor: this.chartService.createStripePattern(color.border),
			borderColor: color.border,
			borderWidth: 1,
			borderRadius: 0,
			yAxisID: 'y',
		};
	}

	/** Builds a solid bar dataset for promises (volume mode) */
	private buildBarPromiseDataset(data: {x: number; y: number}[], unit: string, color: {bg: string; border: string}): any {
		return {
			data,
			label: unit.toUpperCase(),
			_type: 'promise',
			_unit: unit,
			stack: 'counts',
			backgroundColor: (context: any) => this.chartService.createAreaGradient(context, color.border),
			borderColor: color.border,
			borderWidth: 1,
			borderSkipped: false,
			borderRadius: 0,
			yAxisID: 'y',
		};
	}

	/* *******************************************************
		Options
	******************************************************** */

	/** Gets chart options for ecash chart (totals and volume) */
	private getEcashChartOptions(): ChartConfiguration['options'] {
		const data = this.chart_data();
		if (!data || data.datasets.length === 0 || !this.page_settings()) return {};

		const scales: ScaleChartOptions<'line'>['scales'] = {};
		scales['x'] = {
			...getXAxisConfig(this.page_settings().interval, this.locale()),
			stacked: true,
		};
		const grid_color = this.chartService.getGridColor();
		const mark_zero_color = this.chartService.getGridColor('--mat-sys-surface-container-high');
		const locale = this.locale();
		scales['y'] = {
			position: 'left' as const,
			beginAtZero: true,
			stacked: true,
			ticks: {
				callback: (value: string | number) => formatAxisValue(Number(value), locale),
			},
			grid: {
				display: true,
				lineWidth: (context: any) => (context.tick.value === 0 ? 2 : 1),
				color: (context: any) => (context.tick.value === 0 ? mark_zero_color : grid_color),
			},
		} as any;

		return {
			responsive: true,
			maintainAspectRatio: false,
			elements: {
				line: {
					tension: 0.5,
					cubicInterpolationMode: 'monotone',
				},
			},
			scales: scales,
			plugins: {
				tooltip: {
					enabled: true,
					mode: 'index',
					intersect: false,
					itemSort: (a: any, b: any) => {
						const type_order: Record<string, number> = {proof: 0, promise: 1};
						return (type_order[a.dataset._type] ?? 2) - (type_order[b.dataset._type] ?? 2);
					},
					callbacks: {
						title: getTooltipTitle,
						beforeLabel: (context: any) => {
							const type = context.dataset._type;
							const all_items = context.chart.tooltip.dataPoints;
							const sorted = [...all_items].sort((a: any, b: any) => {
								const order: Record<string, number> = {proof: 0, promise: 1};
								return (order[a.dataset._type] ?? 2) - (order[b.dataset._type] ?? 2);
							});
							const first_of_type = sorted.find((p: any) => p.dataset._type === type);
							if (first_of_type?.datasetIndex === context.datasetIndex) {
								return type === 'proof' ? 'Proofs (received)' : 'Blind Signatures (issued)';
							}
							return '';
						},
						label: (context: any) => {
							const label = context.dataset.label || '';
							const value = context.parsed.y ?? 0;
							return ` ${label}: ${value.toLocaleString(this.locale())}`;
						},
						labelColor: (context: any) => ({
							borderColor: context.dataset.borderColor,
							backgroundColor: context.dataset.borderColor,
							borderWidth: 2,
							borderRadius: 0,
						}),
						footer: (items: any[]) => {
							const total = items.reduce((sum: number, item: any) => sum + (item.parsed.y ?? 0), 0);
							return `Total: ${total.toLocaleString(this.locale())}`;
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

	/* *******************************************************
		Annotations
	******************************************************** */

	private getAnnotations(): any {
		const min_x_value = this.findMinimumXValue(this.chart_data());
		const milli_genesis_time = DateTime.fromSeconds(this.mint_genesis_time()).startOf('day').toMillis();
		const display = milli_genesis_time >= min_x_value;
		const config = this.chartService.getFormAnnotationConfig(false);

		return {
			annotations: {
				annotation: {
					type: 'line',
					borderColor: config.border_color,
					borderWidth: config.border_width,
					display: display,
					label: {
						display: true,
						content: 'Mint Genesis',
						position: 'start',
						backgroundColor: config.label_bg_color,
						color: config.text_color,
						font: {
							size: 12,
							weight: '300',
						},
						borderColor: config.label_border_color,
						borderWidth: 1,
					},
					scaleID: 'x',
					value: milli_genesis_time,
				},
			},
		};
	}

	private findMinimumXValue(chartData: ChartConfiguration['data']): number {
		if (!chartData?.datasets || chartData.datasets.length === 0) return 0;
		const all_x_values = chartData.datasets.flatMap((dataset) => dataset.data.map((point: any) => point.x));
		if (all_x_values.length === 0) return 0;
		return all_x_values.reduce((min, val) => (val < min ? val : min), all_x_values[0]);
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Toggles dataset visibility in the chart */
	public toggleDataset(dataset: any): void {
		const chart = this.chart?.chart;
		if (!chart) return;
		const index = dataset._index;
		const is_visible = chart.isDatasetVisible(index);
		chart.setDatasetVisibility(index, !is_visible);
		chart.update();
		this.hidden_datasets.update((set) => {
			const new_set = new Set(set);
			is_visible ? new_set.add(index) : new_set.delete(index);
			return new_set;
		});
	}

	/** Reapplies hidden dataset visibility to the Chart.js instance after data refresh */
	private applyHiddenDatasets(): void {
		const chart = this.chart?.chart;
		if (!chart) return;
		const hidden = this.hidden_datasets();
		if (hidden.size === 0) return;
		hidden.forEach((index) => {
			if (index < chart.data.datasets.length) {
				chart.setDatasetVisibility(index, false);
			}
		});
		chart.update();
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
