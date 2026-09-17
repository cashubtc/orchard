/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	Input,
	input,
	OnChanges,
	OnDestroy,
	SimpleChanges,
	ViewChild,
	ChangeDetectorRef,
} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartType as ChartJsType} from 'chart.js';
import {DateTime} from 'luxon';
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {getUnitMeta, toDisplayAmountFor} from '@client/modules/local/helpers/unit.helpers';
import {DataType} from '@client/modules/orchard/enums/data.enum';
import {NonNullableMintDatabaseSettings} from '@client/modules/settings/types/setting.types';
import {getYAxisId} from '@client/modules/chart/helpers/mint-chart-data.helpers';
import {
	getYAxis,
	getBtcYAxisConfig,
	getUnitYAxisConfig,
	getTooltipTitleExact,
	getTooltipLabel,
	formatAxisValue,
} from '@client/modules/chart/helpers/mint-chart-options.helpers';
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
/* Native Dependencies */
import {MintSubsectionDatabaseData} from '@client/modules/mint/modules/mint-subsection-database/classes/mint-subsection-database-data.class';
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {MintSwap} from '@client/modules/mint/classes/mint-swap.class';

@Component({
	selector: 'orc-mint-subsection-database-chart',
	standalone: false,
	templateUrl: './mint-subsection-database-chart.component.html',
	styleUrl: './mint-subsection-database-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDatabaseChartComponent implements OnChanges, OnDestroy {
	@ViewChild(BaseChartDirective) public chart?: BaseChartDirective;

	@Input() public locale!: string;
	@Input() public data!: MintSubsectionDatabaseData;
	@Input() public filter!: string;
	@Input() public page_settings!: NonNullableMintDatabaseSettings | undefined;
	@Input() public mint_genesis_time!: number;
	@Input() public loading!: boolean;
	@Input() public state_enabled!: boolean;
	@Input() public highlighted_entity_id: string | null = null;
	public readonly device_mobile = input.required<boolean>();

	public chart_type!: ChartJsType;
	public chart_data!: ChartConfiguration['data'];
	public chart_options!: ChartConfiguration['options'];
	public displayed: boolean = true;

	public get mints_data(): MintMintQuote[] {
		if (this.data.type === DataType.MintMints) return this.data.source.filteredData;
		return [];
	}
	public get melts_data(): MintMeltQuote[] {
		if (this.data.type === DataType.MintMelts) return this.data.source.filteredData;
		return [];
	}
	public get swaps_data(): MintSwap[] {
		if (this.data.type === DataType.MintSwaps) return this.data.source.filteredData;
		return [];
	}

	private subscriptions: Subscription = new Subscription();

	constructor(
		private chartService: ChartService,
		private cdr: ChangeDetectorRef,
	) {
		this.subscriptions.add(this.getRemoveSubscription());
		this.subscriptions.add(this.getAddSubscription());
	}

	public ngOnChanges(changes: SimpleChanges): void {
		if (changes['loading'] && this.loading === false) {
			this.init();
		}
		if (changes['filter'] && !changes['filter'].firstChange) {
			this.chart_data = this.getChartData();
		}
		if (changes['highlighted_entity_id'] && !changes['highlighted_entity_id'].firstChange) {
			this.updateChartHighlight();
		}
	}

	private getRemoveSubscription(): Subscription {
		return this.chartService.onResizeStart().subscribe(() => {
			this.displayed = false;
			this.cdr.detectChanges();
		});
	}
	private getAddSubscription(): Subscription {
		return this.chartService.onResizeEnd().subscribe(() => {
			this.displayed = true;
			this.cdr.detectChanges();
		});
	}

	private async init(): Promise<void> {
		this.chart_type = 'scatter';
		this.chart_data = this.getChartData();
		this.chart_options = this.getChartOptions();
		if (this.chart_options?.plugins) this.chart_options.plugins.annotation = this.getAnnotations();
	}

	private getChartData(): ChartConfiguration['data'] {
		if (this.data.type === DataType.MintMints) return this.getMintsData();
		if (this.data.type === DataType.MintMelts) return this.getMeltsData();
		if (this.data.type === DataType.MintSwaps) return this.getSwapsData();
		return {datasets: []};
	}

	private getMintsData(): ChartConfiguration['data'] {
		if (!this.page_settings) return {datasets: []};
		if (!this.data?.source || this.data?.source.data.length === 0) return {datasets: []};
		const data_unit_groups = this.mints_data.reduce(
			(groups, entity) => {
				const unit = entity.unit;
				groups[unit] = groups[unit] || [];
				groups[unit].push(entity);
				return groups;
			},
			{} as Record<string, MintMintQuote[]>,
		);
		return this.getDatasets(data_unit_groups);
	}

	private getMeltsData(): ChartConfiguration['data'] {
		if (!this.page_settings) return {datasets: []};
		if (!this.data?.source || this.data?.source.data.length === 0) return {datasets: []};
		const data_unit_groups = this.melts_data.reduce(
			(groups, entity) => {
				const unit = entity.unit;
				groups[unit] = groups[unit] || [];
				groups[unit].push(entity);
				return groups;
			},
			{} as Record<string, MintMeltQuote[]>,
		);
		return this.getDatasets(data_unit_groups);
	}

	private getSwapsData(): ChartConfiguration['data'] {
		if (!this.page_settings) return {datasets: []};
		if (!this.data?.source || this.data?.source.data.length === 0) return {datasets: []};
		const data_unit_groups = this.swaps_data.reduce(
			(groups, entity) => {
				const unit = entity.unit;
				groups[unit] = groups[unit] || [];
				groups[unit].push(entity);
				return groups;
			},
			{} as Record<string, MintSwap[]>,
		);
		return this.getDatasets(data_unit_groups);
	}

	private getDatasets(data_unit_groups: Record<string, MintMintQuote[] | MintMeltQuote[] | MintSwap[]>): ChartConfiguration['data'] {
		const datasets = Object.entries(data_unit_groups).map(([unit, data], index) => {
			const color = this.chartService.getAssetColor(unit, index);
			const active_color = this.chartService.hexToRgba(color.border, 0.75);
			const dimmed_color = this.chartService.hexToRgba(color.border, 0.15);
			const meta = getUnitMeta(unit);
			const data_prepped = data.map((entity) => ({
				x: (entity.created_time ?? 0) * 1000,
				y: toDisplayAmountFor(meta, this.getEffectiveAmount(entity)),
				state: 'state' in entity ? entity.state : undefined,
				entity_id: entity.id,
			}));
			const yAxisID = getYAxisId(unit);
			return {
				data: data_prepped,
				label: unit.toUpperCase(),
				backgroundColor: (context: any) => this.getPointColor(context, active_color, dimmed_color),
				borderColor: (context: any) => this.getPointColor(context, active_color, dimmed_color),
				pointBackgroundColor: (context: any) => this.getPointColor(context, active_color, dimmed_color),
				pointBorderColor: (context: any) => this.getPointColor(context, active_color, dimmed_color),
				pointHoverBackgroundColor: this.chartService.getPointHoverBackgroundColor(),
				pointHoverBorderColor: active_color,
				pointRadius: (context: any) => this.getPointRadius(context, 3),
				pointHoverRadius: 4,
				pointStyle: (context: any) => {
					const entity = data[context.dataIndex];
					const state = 'state' in entity ? entity.state : undefined;
					return this.chartService.getStatePointStyle(this.data.type, state);
				},
				tension: 0.4,
				yAxisID: yAxisID,
			};
		});

		return {datasets};
	}

	/**
	 * Updates chart visual highlight state without rebuilding datasets
	 */
	private updateChartHighlight(): void {
		if (!this.chart?.chart) return;
		this.chart.chart.update();
	}

	/**
	 * Returns the appropriate color for a data point based on highlight state
	 * @param context - Chart.js scriptable context
	 * @param active_color - color when point is highlighted or no highlight active
	 * @param dimmed_color - color when point is dimmed
	 */
	private getPointColor(context: any, active_color: string, dimmed_color: string): string {
		if (!this.highlighted_entity_id) return active_color;
		const point = context.dataset.data[context.dataIndex];
		if (!point) return dimmed_color;
		return point.entity_id === this.highlighted_entity_id ? active_color : dimmed_color;
	}

	/**
	 * Returns the appropriate radius for a data point based on highlight state
	 * @param context - Chart.js scriptable context
	 * @param default_radius - normal point radius
	 */
	private getPointRadius(context: any, default_radius: number): number {
		if (!this.highlighted_entity_id) return default_radius;
		const point = context.dataset.data[context.dataIndex];
		if (!point) return default_radius;
		return point.entity_id === this.highlighted_entity_id ? default_radius * 1.5 : default_radius;
	}

	private getEffectiveAmount(entity: MintMintQuote | MintMeltQuote | MintSwap): number {
		if (entity instanceof MintMintQuote) return entity.amount_paid;
		return entity.amount;
	}

	private getChartOptions(): ChartConfiguration['options'] {
		if (!this.chart_data || this.chart_data.datasets.length === 0) return {};
		const data = (this.chart_data.datasets[0]?.data as {x: number; y: number}[]) || [];
		const min_time = this.page_settings?.date_start ? this.page_settings.date_start * 1000 : Date.now();
		const max_time = this.page_settings?.date_end ? this.page_settings.date_end * 1000 : Date.now();
		const min_amount = data.length ? Math.min(...data.map((d) => d.y)) : 0;
		const max_amount = data.length ? Math.max(...data.map((d) => d.y)) : 0;
		const span_days = (max_time - min_time) / (1000 * 60 * 60 * 24);
		const time_unit = span_days > 90 ? 'month' : span_days > 21 ? 'week' : span_days >= 1 ? 'day' : 'hour';
		const use_log_scale = max_amount / min_amount >= 100;
		const step_size = 1;

		const units = this.chart_data.datasets.map((item) => item.label);
		const y_axis = getYAxis(units);
		const scales: any = {};
		if (y_axis.includes('ybtc'))
			scales['ybtc'] = {
				...getBtcYAxisConfig({
					grid_color: this.chartService.getGridColor(),
					locale: this.locale,
				}),
				type: use_log_scale ? 'logarithmic' : 'linear',
				beginAtZero: !use_log_scale,
				ticks: use_log_scale
					? {
							callback: (value: string | number): string | null => {
								const num = Number(value);
								return num === 1 || Math.log10(num) % 1 === 0 ? formatAxisValue(num, this.locale) : null;
							},
						}
					: {callback: (value: string | number) => formatAxisValue(Number(value), this.locale)},
			};
		if (y_axis.includes('yfiat'))
			scales['yfiat'] = {
				...getUnitYAxisConfig({
					family: 'fiat',
					units,
					show_grid: y_axis[0] === 'yfiat',
					grid_color: this.chartService.getGridColor(),
					locale: this.locale,
				}),
				type: use_log_scale ? 'logarithmic' : 'linear',
				beginAtZero: !use_log_scale,
				ticks: use_log_scale
					? {
							callback: (value: string | number): string | null => {
								const num = Number(value);
								return num === 1 || Math.log10(num) % 1 === 0 ? formatAxisValue(num, this.locale) : null;
							},
						}
					: {callback: (value: string | number) => formatAxisValue(Number(value), this.locale)},
			};
		if (y_axis.includes('ycustom'))
			scales['ycustom'] = {
				...getUnitYAxisConfig({
					family: 'custom',
					units,
					show_grid: y_axis[0] === 'ycustom',
					grid_color: this.chartService.getGridColor(),
					locale: this.locale,
					position: y_axis[0] === 'ycustom' ? 'left' : 'right',
				}),
				type: use_log_scale ? 'logarithmic' : 'linear',
				beginAtZero: !use_log_scale,
				ticks: use_log_scale
					? {
							callback: (value: string | number): string | null => {
								const num = Number(value);
								return num === 1 || Math.log10(num) % 1 === 0 ? formatAxisValue(num, this.locale) : null;
							},
						}
					: {callback: (value: string | number) => formatAxisValue(Number(value), this.locale)},
			};

		scales['x'] = {
			type: 'time',
			time: {
				unit: time_unit,
				stepSize: step_size,
				displayFormats: {
					month: 'MMM yyyy',
					week: 'MMM d',
					day: 'MMM d',
					hour: 'HH:mm',
				},
			},
			grid: {
				display: true,
				color: this.chartService.getGridColor(),
			},
			min: min_time,
			max: max_time,
			ticks: {
				source: 'auto', // Ensures ticks are generated uniformly
				autoSkip: false, // Show all ticks for the chosen unit
				maxRotation: 0,
				minRotation: 0,
			},
		};

		return {
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
					mode: 'nearest',
					intersect: false,
					callbacks: {
						title: getTooltipTitleExact,
						label: (context: any) => getTooltipLabel(context, this.locale),
					},
				},
				legend: {
					display: false,
				},
			},
			interaction: {
				mode: 'nearest',
				axis: 'x',
				intersect: false,
			},
		};
	}

	private getAnnotations(): any {
		const min_x_value = this.findMinimumXValue(this.chart_data);
		const milli_genesis_time = DateTime.fromSeconds(this.mint_genesis_time).startOf('day').toMillis();
		const display = milli_genesis_time >= min_x_value ? true : false;
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
		return Math.min(...all_x_values);
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
