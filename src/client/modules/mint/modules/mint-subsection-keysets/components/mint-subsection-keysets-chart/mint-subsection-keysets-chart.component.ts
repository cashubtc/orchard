/* Core Dependencies */
import {ChangeDetectionStrategy, Component, effect, input, signal, viewChild, OnDestroy} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ScaleChartOptions, ChartType as ChartJsType, Plugin} from 'chart.js';
import {DateTime} from 'luxon';
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {NonNullableMintKeysetsSettings} from '@client/modules/settings/types/setting.types';
import {getAmountData, getAllPossibleTimestamps, getYAxisId, getTimeInterval} from '@client/modules/chart/helpers/mint-chart-data.helpers';
import {
	getXAxisConfig,
	getYAxis,
	getBtcYAxisConfig,
	getFiatYAxisConfig,
	getTooltipTitle,
	getTooltipLabel,
} from '@client/modules/chart/helpers/mint-chart-options.helpers';
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintAnalyticKeyset} from '@client/modules/mint/classes/mint-analytic.class';
/* Shared Dependencies */
import {AnalyticsInterval} from '@shared/generated.types';

@Component({
	selector: 'orc-mint-subsection-keysets-chart',
	standalone: false,
	templateUrl: './mint-subsection-keysets-chart.component.html',
	styleUrl: './mint-subsection-keysets-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionKeysetsChartComponent implements OnDestroy {
	/* View Children */
	public readonly chart = viewChild(BaseChartDirective);

	/* Inputs */
	public readonly locale = input.required<string>();
	public readonly interval = input.required<AnalyticsInterval>();
	public readonly keysets = input.required<MintKeyset[]>();
	public readonly keysets_analytics = input.required<MintAnalyticKeyset[]>();
	public readonly keysets_analytics_pre = input.required<MintAnalyticKeyset[]>();
	public readonly page_settings = input<NonNullableMintKeysetsSettings>();
	public readonly mint_genesis_time = input.required<number>();
	public readonly loading = input.required<boolean>();
	public readonly highlighted_keyset_id = input<string | null>(null);

	/* State */
	public readonly chart_type = signal<ChartJsType>('line');
	public readonly chart_data = signal<ChartConfiguration['data']>({datasets: []});
	public readonly chart_options = signal<ChartConfiguration['options']>({});
	public readonly chart_plugins = signal<Plugin[]>([]);
	public readonly displayed = signal<boolean>(true);

	private subscriptions: Subscription = new Subscription();
	private dataset_styles = new Map<string, {muted_color: string; color_hex: string; is_active: boolean; bg_color: any}>();

	constructor(private chartService: ChartService) {
		this.subscriptions.add(this.getRemoveSubscription());
		this.subscriptions.add(this.getAddSubscription());

		/* Effect: Initialize chart when loading completes */
		effect(() => {
			if (this.loading() !== false) return;
			this.init();
			setTimeout(() => {
				this.chart()?.chart?.resize();
			}, 50);
		});

		/* Effect: React to highlight changes */
		effect(() => {
			this.highlighted_keyset_id();
			this.updateChartHighlight();
		});
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
		const settings = this.page_settings();
		const status_filter = settings?.status ?? [];
		const units_filter = settings?.units ?? [];
		const valid_keysets = this.keysets()
			.filter((keyset) => keyset.valid_from !== null)
			.filter((keyset) => !status_filter.length || status_filter.includes(keyset.active))
			.filter((keyset) => !units_filter.length || units_filter.includes(keyset.unit));
		const valid_keysets_ids = valid_keysets.map((keyset) => keyset.id);
		const valid_analytics = this.keysets_analytics().filter((analytic) => valid_keysets_ids.includes(analytic.keyset_id));
		const valid_analytics_pre = this.keysets_analytics_pre().filter((analytic) => valid_keysets_ids.includes(analytic.keyset_id));
		const data = this.getChartData(valid_analytics, valid_analytics_pre);
		this.chart_data.set(data);
		const options = this.getChartOptions(valid_keysets_ids, data);
		if (options?.plugins) options.plugins.annotation = this.getAnnotations(data);
		this.chart_options.set(options);
		this.initGlowPlugin(valid_keysets, data);
	}

	/**
	 * Creates the glow effect plugin for active keysets only (not dashed/inactive ones)
	 */
	private initGlowPlugin(valid_keysets: MintKeyset[], data: ChartConfiguration['data']): void {
		if (!data?.datasets || data.datasets.length === 0) {
			this.chart_plugins.set([]);
			return;
		}
		const first_active_dataset = data.datasets.find((dataset) => {
			const keyset = valid_keysets.find((k) => dataset.label?.includes(`Gen ${k.derivation_path_index}`));
			return keyset?.active === true;
		});
		if (!first_active_dataset) {
			this.chart_plugins.set([]);
			return;
		}
		const color = first_active_dataset.borderColor as string;
		this.chart_plugins.set(color ? [this.chartService.createGlowPlugin(color)] : []);
	}

	private getChartData(valid_analytics: MintAnalyticKeyset[], valid_analytics_pre: MintAnalyticKeyset[]): ChartConfiguration['data'] {
		const settings = this.page_settings();
		if (!settings) return {datasets: []};
		if ((!valid_analytics || valid_analytics.length === 0) && (!valid_analytics_pre || valid_analytics_pre.length === 0))
			return {datasets: []};
		const interval = this.interval();
		const keysets = this.keysets();
		const time_interval = getTimeInterval(interval);
		const timestamp_first = DateTime.fromSeconds(settings.date_start).startOf(time_interval).toSeconds();
		const timestamp_last = DateTime.fromSeconds(settings.date_end).startOf(time_interval).toSeconds();
		const data_keyset_groups = valid_analytics.reduce(
			(groups, analytic) => {
				const id = analytic.keyset_id;
				groups[id] = groups[id] || [];
				groups[id].push({...analytic});
				return groups;
			},
			{} as Record<string, MintAnalyticKeyset[]>,
		);
		const data_keyset_groups_prepended = this.prependData(
			data_keyset_groups,
			valid_analytics_pre.map((a) => ({...a})),
			timestamp_first,
		);
		const datasets = Object.entries(data_keyset_groups_prepended).map(([keyset_id, data], index) => {
			const keyset = keysets.find((k) => k.id === keyset_id);
			const unit = keyset?.unit || '';
			const keyset_genesis_time = keyset
				? DateTime.fromSeconds(keyset.valid_from!).startOf(time_interval).toSeconds()
				: timestamp_first;
			const min_x = Math.max(keyset_genesis_time, timestamp_first);
			const timestamp_range = getAllPossibleTimestamps(min_x, timestamp_last, interval);
			const data_keyed_by_timestamp = data.reduce(
				(acc, item) => {
					acc[item.date] = Number(item.amount);
					return acc;
				},
				{} as Record<string, number>,
			);
			const color = this.chartService.getAssetColor(unit, index);
			const cumulative = this.chart_type() === 'line';
			let data_prepped = getAmountData(timestamp_range, data_keyed_by_timestamp, unit, cumulative);

			if (data_prepped[0].x === keyset_genesis_time * 1000) {
				data_prepped = [{x: data_prepped[0].x, y: 0}, ...data_prepped];
			}

			if (keyset && !keyset.active) {
				const successor_keyset = keysets.find(
					(k) => k.unit === keyset.unit && k.derivation_path_index === keyset.derivation_path_index + 1,
				);
				const successor_keyset_genesis_time = successor_keyset
					? DateTime.fromSeconds(successor_keyset.valid_from!).startOf(time_interval).toSeconds()
					: timestamp_last;
				const death_sentance = Math.min(successor_keyset_genesis_time, timestamp_last) * 1000;
				const time_of_death_index = data_prepped.findIndex((d) => d.x >= death_sentance && d.y === 0);
				if (time_of_death_index !== -1) data_prepped = data_prepped.slice(0, time_of_death_index + 1);
			}
			const yAxisID = getYAxisId(unit);
			const label = keyset ? `${unit.toUpperCase()} Gen ${keyset.derivation_path_index}` : keyset_id;
			const is_active = keyset?.active ?? true;
			const muted_color = this.chartService.getMutedColor(color.border);

			const bg_color = is_active ? (context: any) => this.chartService.createAreaGradient(context, color.border) : color.bg;
			this.dataset_styles.set(keyset_id, {muted_color, color_hex: color.border, is_active, bg_color});

			return {
				data: data_prepped,
				label: label,
				keyset_id: keyset_id,
				backgroundColor: bg_color,
				borderColor: muted_color,
				borderWidth: 2,
				borderRadius: 3,
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
				borderDash: !is_active ? [5, 5] : undefined,
			};
		});

		return {datasets};
	}

	private prependData(
		analytics: Record<string, MintAnalyticKeyset[]>,
		preceding_data: MintAnalyticKeyset[],
		timestamp_first: number,
	): Record<string, MintAnalyticKeyset[]> {
		if (preceding_data.length === 0) return analytics;

		for (const preceding of preceding_data) {
			preceding.date = timestamp_first;
			const analytics_for_id = analytics[preceding.keyset_id];
			if (!analytics_for_id) {
				analytics[preceding.keyset_id] = [preceding];
				continue;
			}
			const matching_datapoint = analytics_for_id.find((a) => a.date === preceding.date);
			if (!matching_datapoint) {
				analytics_for_id.unshift(preceding);
			} else {
				matching_datapoint.amount = String(BigInt(matching_datapoint.amount) + BigInt(preceding.amount));
			}
		}
		return analytics;
	}

	/**
	 * Dims non-highlighted datasets or restores all to original styles
	 */
	private updateChartHighlight(): void {
		const chart = this.chart()?.chart;
		if (!chart) return;
		const highlighted_id = this.highlighted_keyset_id();

		chart.data.datasets.forEach((dataset: any) => {
			const styles = this.dataset_styles.get(dataset.keyset_id);
			if (!styles) return;

			if (!highlighted_id || dataset.keyset_id === highlighted_id) {
				dataset.borderColor = styles.muted_color;
				dataset.pointBackgroundColor = styles.muted_color;
				dataset.pointBorderColor = styles.muted_color;
				dataset.backgroundColor = styles.bg_color;
			} else {
				const dimmed = this.chartService.hexToRgba(styles.color_hex, 0.1);
				dataset.borderColor = dimmed;
				dataset.pointBackgroundColor = dimmed;
				dataset.pointBorderColor = dimmed;
				dataset.backgroundColor = 'transparent';
			}
		});

		chart.update();
	}

	private getChartOptions(valid_keysets_ids: string[], data: ChartConfiguration['data']): ChartConfiguration['options'] {
		const settings = this.page_settings();
		if (!data || data.datasets.length === 0 || !settings) return {};
		const locale = this.locale();
		const units = this.keysets()
			.filter((keyset) => valid_keysets_ids.includes(keyset.id))
			.map((keyset) => keyset.unit.toUpperCase());
		const y_axis = getYAxis(units);
		const scales: ScaleChartOptions<'line'>['scales'] = {};
		scales['x'] = getXAxisConfig(this.interval(), locale);
		if (y_axis.includes('ybtc')) {
			scales['ybtc'] = getBtcYAxisConfig({
				grid_color: this.chartService.getGridColor(),
				begin_at_zero: true,
				locale,
			});
		}
		if (y_axis.includes('yfiat')) {
			scales['yfiat'] = getFiatYAxisConfig({
				units,
				show_grid: !y_axis.includes('ybtc'),
				grid_color: this.chartService.getGridColor(),
				begin_at_zero: true,
				locale,
			});
		}

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
						title: getTooltipTitle,
						label: (context: any) => getTooltipLabel(context, locale),
					},
				},
				legend: {
					display: true,
					position: 'top',
					labels: {
						padding: 15,
						font: {
							size: 12,
						},
					},
				},
			},
			interaction: {
				mode: 'nearest',
				axis: 'x',
				intersect: false,
			},
		};
	}

	private getAnnotations(data: ChartConfiguration['data']): any {
		const settings = this.page_settings();
		const min_x_value = this.findMinimumXValue(data) / 1000;
		const max_x_value = this.findMaximumXValue(data) / 1000;
		const config = this.chartService.getFormAnnotationConfig(false);
		const annotations: Record<string, any> = {};
		this.keysets()
			.filter((keyset) => keyset.valid_from! >= min_x_value && keyset.valid_from! <= max_x_value)
			.filter((keyset) => settings?.status.includes(keyset.active))
			.filter((keyset) => settings?.units.includes(keyset.unit))
			.forEach((keyset) => {
				const milli_keyset_time = DateTime.fromSeconds(keyset.valid_from!).startOf('day').toMillis();
				const display_keyset = milli_keyset_time >= min_x_value ? true : false;
				const label = this.getAnnotationLabel(keyset);
				annotations[`keyset_${keyset.id}`] = {
					type: 'line',
					borderColor: config.border_color,
					borderWidth: config.border_width,
					display: display_keyset,
					label: {
						display: true,
						content: label,
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
					value: milli_keyset_time,
				};
			});
		return {annotations};
	}

	private findMinimumXValue(chartData: ChartConfiguration['data']): number {
		if (!chartData?.datasets || chartData.datasets.length === 0) return 0;
		const all_x_values = chartData.datasets.flatMap((dataset) => dataset.data.map((point: any) => point.x));
		return Math.min(...all_x_values);
	}

	private findMaximumXValue(chartData: ChartConfiguration['data']): number {
		if (!chartData?.datasets || chartData.datasets.length === 0) return 0;
		const all_x_values = chartData.datasets.flatMap((dataset) => dataset.data.map((point: any) => point.x));
		const max_x_value = Math.max(...all_x_values);
		return DateTime.fromMillis(max_x_value).endOf('day').toMillis();
	}

	private getAnnotationLabel(keyset: MintKeyset): string {
		if (this.mint_genesis_time() === keyset.valid_from) return `Mint Genesis`;
		return `${keyset.unit.toUpperCase()} Rotation ${keyset.derivation_path_index}`;
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
