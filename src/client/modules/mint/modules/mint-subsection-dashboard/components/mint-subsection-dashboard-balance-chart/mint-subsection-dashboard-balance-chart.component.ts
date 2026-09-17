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
	correctLastPointWithLiveBalance,
} from '@client/modules/chart/helpers/mint-chart-data.helpers';
import {eligibleForOracleConversion} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {
	getXAxisConfig,
	getYAxis,
	getBtcYAxisConfig,
	getUnitYAxisConfig,
	getTooltipTitle,
} from '@client/modules/chart/helpers/mint-chart-options.helpers';
import {toDisplayAmount} from '@client/modules/local/helpers/unit.helpers';
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
import {LightningBalance} from '@client/modules/lightning/classes/lightning-balance.class';
/* Native Dependencies */
import {MintAnalytic} from '@client/modules/mint/classes/mint-analytic.class';
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {LightningAnalytic} from '@client/modules/lightning/classes/lightning-analytic.class';
import {ChartType} from '@client/modules/mint/enums/chart-type.enum';
@Component({
	selector: 'orc-mint-subsection-dashboard-balance-chart',
	standalone: false,
	templateUrl: './mint-subsection-dashboard-balance-chart.component.html',
	styleUrl: './mint-subsection-dashboard-balance-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDashboardBalanceChartComponent implements OnDestroy, OnChanges {
	@ViewChild(BaseChartDirective) chart?: BaseChartDirective;

	public locale = input.required<string>();
	public mint_analytics = input.required<MintAnalytic[]>();
	public mint_analytics_pre = input.required<MintAnalytic[]>();
	public bitcoin_oracle_price_map = input.required<Map<number, number> | null>();
	public lightning_balance = input.required<LightningBalance | null>();
	public lightning_analytics = input.required<LightningAnalytic[]>();
	public lightning_analytics_pre = input.required<LightningAnalytic[]>();
	public page_settings = input.required<NonNullableMintDashboardSettings>();
	public oracle_used = input.required<boolean>();
	public mint_genesis_time = input.required<number>();
	public selected_type = input.required<ChartType | null | undefined>();
	public loading = input.required<boolean>();
	public lightning_enabled = input.required<boolean>();
	public device_mobile = input.required<boolean>();
	public mint_balances = input.required<MintBalance[]>();
	public mint_keysets = input.required<MintKeyset[]>();

	public chart_type!: ChartJsType;
	public chart_data = signal<ChartConfiguration['data']>({datasets: []});
	public chart_options!: ChartConfiguration['options'];
	public chart_plugins: Plugin[] = [];
	public displayed = signal<boolean>(true);
	public hidden_datasets = signal<Set<number>>(new Set());

	public liability_datasets = computed(
		() =>
			this.chart_data()
				.datasets?.map((d, i) => ({...d, _index: i}))
				.filter((d) => (d as any)._type === 'liability') ?? [],
	);
	public asset_datasets = computed(
		() =>
			this.chart_data()
				.datasets?.map((d, i) => ({...d, _index: i}))
				.filter((d) => (d as any)._type === 'asset') ?? [],
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
		const has_mint_data = this.mint_analytics().length > 0 || this.mint_analytics_pre().length > 0;
		const has_lightning_data = this.lightning_analytics().length > 0 || this.lightning_analytics_pre().length > 0;
		if (!has_mint_data && !has_lightning_data) return;

		switch (this.selected_type()) {
			case ChartType.Totals:
				this.chart_type = 'line';
				this.chart_data.set(this.getBalanceSheetTotalsData());
				this.chart_options = this.getBalanceSheetChartOptions();
				this.initGlowPlugin();
				break;
			case ChartType.Volume:
				this.chart_type = 'bar';
				this.chart_data.set(this.getBalanceSheetVolumeData());
				this.chart_options = this.getBalanceSheetChartOptions();
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

	/**
	 * Creates the glow effect plugin for chart points (line charts only)
	 */
	private initGlowPlugin(): void {
		const data = this.chart_data();
		if (!data?.datasets || data.datasets.length === 0) {
			this.chart_plugins = [];
			return;
		}
		const first_color = data.datasets[0]?.borderColor as string;
		this.chart_plugins = first_color ? [this.chartService.createGlowPlugin(first_color)] : [];
	}

	/**
	 * Gets the balance sheet totals (cumulative) chart data
	 * Includes all unit liabilities and asset (lightning outbound) for sat
	 */
	private getBalanceSheetTotalsData(): ChartConfiguration['data'] {
		if (!this.page_settings()) return {datasets: []};

		const can_use_oracle = this.canUseOracle();
		const oracle_map = this.bitcoin_oracle_price_map();

		const time_interval = getTimeInterval(this.page_settings().interval);
		const timestamp_first = DateTime.fromSeconds(this.page_settings().date_start).startOf(time_interval).toSeconds();
		const timestamp_last = DateTime.fromSeconds(this.page_settings().date_end).startOf(time_interval).toSeconds();
		const timestamp_range = getAllPossibleTimestamps(timestamp_first, timestamp_last, this.page_settings().interval);

		const datasets: any[] = [];

		// Liability datasets for all units (mint balances)
		const data_unit_groups = groupAnalyticsByUnit(this.mint_analytics().map((a) => ({...a})));
		const data_unit_groups_prepended = prependData(
			data_unit_groups,
			this.mint_analytics_pre().map((a) => ({...a})),
			timestamp_first,
		);

		const live_balance_by_unit = this.getLiveBalanceByUnit();

		Object.entries(data_unit_groups_prepended).forEach(([unit, data], index) => {
			const data_keyed_by_timestamp = getDataKeyedByTimestamp(data, 'amount');
			const raw_liability_data = getAmountData(timestamp_range, data_keyed_by_timestamp, unit, true);
			const corrected_liability_data = correctLastPointWithLiveBalance(
				raw_liability_data,
				live_balance_by_unit.get(unit) ?? null,
				this.page_settings().interval,
			);
			const liability_data = convertChartDataWithOracle(corrected_liability_data, unit, oracle_map, can_use_oracle);
			const color = this.chartService.getAssetColor(unit, index);
			const muted_color = this.chartService.getMutedColor(color.border);
			const yAxisID = getYAxisIdWithOracle(unit, can_use_oracle);

			datasets.push({
				data: liability_data,
				label: unit.toUpperCase(),
				_type: 'liability',
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
			});
		});

		// Asset dataset (lightning local balance)
		if (this.lightning_enabled() && (this.lightning_analytics().length > 0 || this.lightning_analytics_pre().length > 0)) {
			const ln_groups = groupAnalyticsByUnit(this.lightning_analytics().map((a) => ({...a})));
			const ln_prepended = prependData(
				ln_groups,
				this.lightning_analytics_pre().map((a) => ({...a})),
				timestamp_first,
			);
			const ln_data = ln_prepended['msat'] || [];
			const ln_keyed = getDataKeyedByTimestamp(ln_data, 'amount');
			const raw_asset_data = getAmountData(timestamp_range, ln_keyed, 'msat', true);
			const live_balance_sat = toDisplayAmount('sat', this.lightning_balance()?.open.local_balance ?? 0);
			const corrected_asset_data = correctLastPointWithLiveBalance(raw_asset_data, live_balance_sat, this.page_settings().interval);
			const asset_data = convertChartDataWithOracle(corrected_asset_data, 'sat', oracle_map, can_use_oracle);
			const asset_color = this.chartService.getAssetColor('sat', 0);
			const muted_asset_color = this.chartService.getMutedColor(asset_color.border);

			datasets.push({
				data: asset_data,
				label: 'SAT',
				_type: 'asset',
				backgroundColor: (context: any) => this.chartService.createAreaGradient(context, asset_color.border, 0.01, 0.1),
				borderColor: muted_asset_color,
				borderWidth: 2,
				borderDash: [15, 4, 3, 4],
				pointBackgroundColor: muted_asset_color,
				pointBorderColor: muted_asset_color,
				pointBorderWidth: 2,
				pointHoverBackgroundColor: this.chartService.getPointHoverBackgroundColor(),
				pointHoverBorderColor: asset_color.border,
				pointHoverBorderWidth: 3,
				pointRadius: 0,
				pointHoverRadius: 4,
				fill: true,
				tension: 0.4,
				yAxisID: getYAxisIdWithOracle('sat', can_use_oracle),
			});
		}

		return {datasets};
	}

	/**
	 * Gets the balance sheet volume (non-cumulative) chart data
	 */
	private getBalanceSheetVolumeData(): ChartConfiguration['data'] {
		if (!this.page_settings()) return {datasets: []};

		const can_use_oracle = this.canUseOracle();
		const oracle_map = this.bitcoin_oracle_price_map();

		const time_interval = getTimeInterval(this.page_settings().interval);
		const timestamp_first = DateTime.fromSeconds(this.page_settings().date_start).startOf(time_interval).toSeconds();
		const timestamp_last = DateTime.fromSeconds(this.page_settings().date_end).startOf(time_interval).toSeconds();
		const timestamp_range = getAllPossibleTimestamps(timestamp_first, timestamp_last, this.page_settings().interval);

		const datasets: any[] = [];

		// Liability datasets for all units (non cumulative)
		const data_unit_groups = groupAnalyticsByUnit(this.mint_analytics().map((a) => ({...a})));

		Object.entries(data_unit_groups).forEach(([unit, data], index) => {
			const data_keyed_by_timestamp = getDataKeyedByTimestamp(data, 'amount');
			const raw_volume_data = getAmountData(timestamp_range, data_keyed_by_timestamp, unit, false);
			const volume_data = convertChartDataWithOracle(raw_volume_data, unit, oracle_map, can_use_oracle);
			const color = this.chartService.getAssetColor(unit, index);
			const yAxisID = getYAxisIdWithOracle(unit, can_use_oracle);

			datasets.push({
				data: volume_data,
				label: unit.toUpperCase(),
				_type: 'liability',
				backgroundColor: (context: any) => this.chartService.createAreaGradient(context, color.border),
				borderColor: color.border,
				borderWidth: 1,
				borderRadius: 0,
				yAxisID: yAxisID,
			});
		});

		// Asset dataset (lightning local balance - non cumulative) - outline style
		if (this.lightning_enabled() && this.lightning_analytics().length > 0) {
			const ln_groups = groupAnalyticsByUnit(this.lightning_analytics().map((a) => ({...a})));
			const ln_data = ln_groups['msat'] || [];
			const ln_keyed = getDataKeyedByTimestamp(ln_data, 'amount');
			const raw_asset_data = getAmountData(timestamp_range, ln_keyed, 'msat', false);
			const asset_data = convertChartDataWithOracle(raw_asset_data, 'sat', oracle_map, can_use_oracle);
			const asset_color = this.chartService.getAssetColor('sat', 0);

			datasets.push({
				data: asset_data,
				label: 'SAT',
				_type: 'asset',
				backgroundColor: this.chartService.createStripePattern(asset_color.border),
				borderColor: asset_color.border,
				borderWidth: 1,
				borderSkipped: false,
				borderRadius: 0,
				yAxisID: getYAxisIdWithOracle('sat', can_use_oracle),
			});
		}

		return {datasets};
	}

	/**
	 * Gets chart options for balance sheet (totals and volume)
	 */
	private getBalanceSheetChartOptions(): ChartConfiguration['options'] {
		const data = this.chart_data();
		if (!data || data.datasets.length === 0 || !this.page_settings) return {};

		const can_use_oracle = this.canUseOracle();

		// When oracle is used, BTC units become USD for axis purposes
		const effective_units = data.datasets.map((item) => {
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
			scales['yfiat'] = getUnitYAxisConfig({
				family: 'fiat',
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
			scales['ycustom'] = getUnitYAxisConfig({
				family: 'custom',
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
					itemSort: (a: any, b: any) => {
						const type_order: Record<string, number> = {asset: 0, liability: 1};
						return (type_order[a.dataset._type] ?? 2) - (type_order[b.dataset._type] ?? 2);
					},
					callbacks: {
						title: getTooltipTitle,
						beforeLabel: (context: any) => {
							const type = context.dataset._type;
							const all_items = context.chart.tooltip.dataPoints;
							const sorted = [...all_items].sort((a: any, b: any) => {
								const order: Record<string, number> = {asset: 0, liability: 1};
								return (order[a.dataset._type] ?? 2) - (order[b.dataset._type] ?? 2);
							});
							const first_of_type = sorted.find((p: any) => p.dataset._type === type);
							if (first_of_type?.datasetIndex === context.datasetIndex) {
								return type === 'asset' ? 'Assets' : 'Liabilities';
							}
							return '';
						},
						label: (context: any) => this.chartService.formatOracleTooltipLabel(context, can_use_oracle),
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

	/**
	 * Computes live balance per unit by joining MintBalance (keyset→balance) with MintKeyset (keyset→unit)
	 */
	private getLiveBalanceByUnit(): Map<string, number> {
		const keyset_unit_map = new Map(this.mint_keysets().map((k) => [k.id, k.unit]));
		const balance_by_unit = new Map<string, number>();
		for (const mb of this.mint_balances()) {
			const unit = keyset_unit_map.get(mb.keyset);
			if (!unit) continue;
			balance_by_unit.set(unit, (balance_by_unit.get(unit) ?? 0) + mb.balance);
		}
		return balance_by_unit;
	}

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

	/**
	 * Reapplies hidden dataset visibility to the Chart.js instance after data refresh
	 */
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

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
