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
	groupAnalyticsByUnit,
	prependData,
	getDataKeyedByTimestamp,
	getAmountData,
	getAllPossibleTimestamps,
	getTimeInterval,
	convertChartDataWithOracle,
	getYAxisIdWithOracle,
} from '@client/modules/chart/helpers/mint-chart-data.helpers';
import {eligibleForOracleConversion} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {
	getXAxisConfig,
	getYAxis,
	getBtcYAxisConfig,
	getFiatYAxisConfig,
	getCustomYAxisConfig,
	getTooltipTitle,
} from '@client/modules/chart/helpers/mint-chart-options.helpers';
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
/* Native Dependencies */
import {MintAnalytic} from '@client/modules/mint/classes/mint-analytic.class';
import {ChartType} from '@client/modules/mint/enums/chart-type.enum';

@Component({
	selector: 'orc-mint-subsection-dashboard-chart',
	standalone: false,
	templateUrl: './mint-subsection-dashboard-chart.component.html',
	styleUrl: './mint-subsection-dashboard-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDashboardChartComponent implements OnDestroy, OnChanges {
	@ViewChild(BaseChartDirective) chart?: BaseChartDirective;

	public locale = input.required<string>();
	public bitcoin_oracle_price_map = input.required<Map<number, number> | null>();
	public mint_analytics = input.required<MintAnalytic[]>();
	public mint_analytics_pre = input.required<MintAnalytic[]>();
	public page_settings = input.required<NonNullableMintDashboardSettings>();
	public oracle_used = input.required<boolean>();
	public mint_genesis_time = input.required<number>();
	public selected_type = input.required<ChartType | null | undefined>();
	public loading = input.required<boolean>();

	public chart_type!: ChartJsType;
	public chart_data!: ChartConfiguration['data'];
	public chart_options!: ChartConfiguration['options'];
	public chart_plugins: Plugin[] = [];
	public displayed = signal<boolean>(true);

	public has_data = computed(() => {
		return this.chart_data?.datasets?.length > 0 && (this.mint_analytics().length > 0 || this.mint_analytics_pre().length > 0);
	});

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
		if (changes['oracle_used'] && !changes['oracle_used'].firstChange) {
			this.init();
		}
	}

	private canUseOracle(): boolean {
		const oracle_used = this.page_settings().oracle_used;
		const oracle_map = this.bitcoin_oracle_price_map();
		return !!(oracle_used && oracle_map && oracle_map.size > 0);
	}

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
		if (this.mint_analytics().length === 0 && this.mint_analytics_pre().length === 0) return;
		switch (this.selected_type()) {
			case ChartType.Totals:
				this.chart_type = 'line';
				this.chart_data = this.getAmountChartData();
				this.chart_options = this.getAmountChartOptions();
				this.initGlowPlugin();
				break;
			case ChartType.Volume:
				this.chart_type = 'bar';
				this.chart_data = this.getAmountChartData(false);
				this.chart_options = this.getAmountChartOptions();
				this.chart_plugins = [];
				break;
		}
		if (this.chart_options?.plugins) this.chart_options.plugins.annotation = this.getAnnotations();
		setTimeout(() => {
			this.chart?.chart?.resize();
		});
		setTimeout(() => {
			this.displayed.set(true);
		}, 50);
	}

	/**
	 * Creates the glow effect plugin for chart points (line charts only)
	 */
	private initGlowPlugin(): void {
		if (!this.chart_data?.datasets || this.chart_data.datasets.length === 0) {
			this.chart_plugins = [];
			return;
		}
		const first_color = this.chart_data.datasets[0]?.borderColor as string;
		this.chart_plugins = first_color ? [this.chartService.createGlowPlugin(first_color)] : [];
	}

	private getAmountChartData(prepend: boolean = true): ChartConfiguration['data'] {
		if (!this.page_settings()) return {datasets: []};
		if (
			(!this.mint_analytics() || this.mint_analytics().length === 0) &&
			(!this.mint_analytics_pre() || this.mint_analytics_pre().length === 0)
		) {
			return {datasets: []};
		}

		const can_use_oracle = this.canUseOracle();
		const oracle_map = this.bitcoin_oracle_price_map();

		const time_interval = getTimeInterval(this.page_settings().interval);
		const timestamp_first = DateTime.fromSeconds(this.page_settings().date_start).startOf(time_interval).toSeconds();
		const timestamp_last = DateTime.fromSeconds(this.page_settings().date_end).startOf(time_interval).toSeconds();
		const timestamp_range = getAllPossibleTimestamps(timestamp_first, timestamp_last, this.page_settings().interval);
		const data_unit_groups = groupAnalyticsByUnit(this.mint_analytics().map((a) => ({...a})));
		const data_unit_groups_prepended = prepend
			? prependData(
					data_unit_groups,
					this.mint_analytics_pre().map((a) => ({...a})),
					timestamp_first,
				)
			: data_unit_groups;
		const datasets = Object.entries(data_unit_groups_prepended).map(([unit, data], index) => {
			const data_keyed_by_timestamp = getDataKeyedByTimestamp(data, 'amount');
			const color = this.chartService.getAssetColor(unit, index);
			const cumulative = this.chart_type === 'line';
			const raw_data = getAmountData(timestamp_range, data_keyed_by_timestamp, unit, cumulative);
			const data_prepped = convertChartDataWithOracle(raw_data, unit, oracle_map, can_use_oracle);
			const yAxisID = getYAxisIdWithOracle(unit, can_use_oracle);

			const muted_color = this.chartService.getMutedColor(color.border);
			return {
				data: data_prepped,
				label: unit.toUpperCase(),
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
				fill: true,
				tension: 0.4,
				yAxisID: yAxisID,
			};
		});

		return {datasets};
	}

	private getAmountChartOptions(): ChartConfiguration['options'] {
		if (!this.chart_data || this.chart_data.datasets.length === 0 || !this.page_settings()) return {};

		const can_use_oracle = this.canUseOracle();

		// When oracle is used, BTC units become USD for axis purposes
		const effective_units = this.chart_data.datasets.map((item) => {
			const label = item.label?.toLowerCase() ?? '';
			if (can_use_oracle && eligibleForOracleConversion(label)) return 'usd';
			return item.label;
		});
		const y_axis = getYAxis(effective_units);
		const scales: ScaleChartOptions<'line'>['scales'] = {};
		scales['x'] = getXAxisConfig(this.page_settings().interval, this.locale());
		if (y_axis.includes('ybtc')) {
			scales['ybtc'] = getBtcYAxisConfig({
				grid_color: this.chartService.getGridColor(),
				begin_at_zero: true,
				mark_zero_color: this.chartService.getGridColor('--mat-sys-surface-container-high'),
				locale: this.locale(),
			});
		}
		if (y_axis.includes('yfiat')) {
			const is_primary_axis = y_axis[0] === 'yfiat';
			scales['yfiat'] = getFiatYAxisConfig({
				units: effective_units,
				show_grid: is_primary_axis,
				grid_color: this.chartService.getGridColor(),
				begin_at_zero: true,
				locale: this.locale(),
				position: is_primary_axis ? 'left' : 'right',
				is_cents: can_use_oracle,
			});
		}
		if (y_axis.includes('ycustom')) {
			const is_primary_axis = y_axis[0] === 'ycustom';
			scales['ycustom'] = getCustomYAxisConfig({
				units: effective_units,
				show_grid: is_primary_axis,
				grid_color: this.chartService.getGridColor(),
				begin_at_zero: true,
				locale: this.locale(),
				position: is_primary_axis ? 'left' : 'right',
			});
		}

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
					callbacks: {
						title: getTooltipTitle,
						label: (context: any) => this.chartService.formatOracleTooltipLabel(context, can_use_oracle),
						labelColor: (context: any) => {
							return {
								borderColor: context.dataset.borderColor,
								backgroundColor: context.dataset.borderColor,
								borderWidth: 2,
								borderRadius: 0,
							};
						},
					},
				},
				legend: {
					display: true,
					position: 'top',
				},
			},
			interaction: {
				mode: 'index',
				axis: 'x',
				intersect: false,
			},
		};
	}

	private getAnnotations(): any {
		const min_x_value = this.findMinimumXValue(this.chart_data);
		const milli_genesis_time = DateTime.fromSeconds(this.mint_genesis_time()).startOf('day').toMillis();
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
