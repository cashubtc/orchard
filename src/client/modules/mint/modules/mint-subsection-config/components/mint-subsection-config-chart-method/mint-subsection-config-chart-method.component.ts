/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	input,
	viewChild,
	OnDestroy,
	signal,
	HostListener,
	SimpleChanges,
	OnChanges,
} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartType as ChartJsType, Plugin} from 'chart.js';
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
import {getTooltipLabel, getTooltipTitleExact} from '@client/modules/chart/helpers/mint-chart-options.helpers';
import {toDisplayAmount} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {MintConfigStats} from '@client/modules/mint/modules/mint-subsection-config/types/mint-config-stats.type';

@Component({
	selector: 'orc-mint-subsection-config-chart-method',
	standalone: false,
	templateUrl: './mint-subsection-config-chart-method.component.html',
	styleUrl: './mint-subsection-config-chart-method.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionConfigChartMethodComponent implements OnChanges, OnDestroy {
	public chart = viewChild(BaseChartDirective);

	public nut = input.required<'nut4' | 'nut5'>();
	public quotes = input.required<MintMintQuote[] | MintMeltQuote[]>();
	public loading = input.required<boolean>();
	public locale = input.required<string>();
	public unit = input.required<string>();
	public method = input.required<string>();
	public min_amount = input.required<number>();
	public max_amount = input.required<number>();
	public min_hot = input.required<boolean>();
	public max_hot = input.required<boolean>();
	public stats = input.required<MintConfigStats>();
	public amounts = input.required<Record<string, number>[]>();

	public chart_type = signal<ChartJsType>('line');
	public chart_data = signal<ChartConfiguration['data']>({datasets: []});
	public chart_options = signal<ChartConfiguration['options']>({});
	public chart_plugins: Plugin[] = [];
	public displayed = signal<boolean>(false);

	private subscriptions: Subscription = new Subscription();
	private resize_timeout: ReturnType<typeof setTimeout> | null = null;

	constructor(private chartService: ChartService) {
		this.subscriptions.add(this.getRemoveSubscription());
		this.subscriptions.add(this.getAddSubscription());
	}

	public ngOnChanges(changes: SimpleChanges): void {
		if (changes['loading'] && this.loading() === false) {
			this.init();
			this.displayed.set(true);
		}
		if (changes['min_amount'] && !changes['min_amount'].firstChange) {
			this.initOptions();
		}
		if (changes['max_amount'] && !changes['max_amount'].firstChange) {
			this.initOptions();
		}
		if (changes['min_hot'] && !changes['min_hot'].firstChange) {
			this.initOptions();
		}
		if (changes['max_hot'] && !changes['max_hot'].firstChange) {
			this.initOptions();
		}
	}

	/**
	 * Handles window resize events by hiding the chart during resize
	 * and showing it again after a debounce delay to prevent layout instability
	 */
	@HostListener('window:resize')
	onWindowResize(): void {
		this.displayed.set(false);
		if (this.resize_timeout) {
			clearTimeout(this.resize_timeout);
		}
		this.resize_timeout = setTimeout(() => {
			this.displayed.set(true);
		}, 150);
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

	private async init(): Promise<void> {
		this.chart_type.set('scatter');
		this.chart_data.set(this.getChartData(this.amounts()));
		this.initOptions();
	}

	private initOptions(): void {
		const options = this.getChartOptions();
		if (options?.plugins) options.plugins.annotation = this.getFormAnnotation();
		this.chart_options.set(options);
	}

	private getChartData(amounts: Record<string, number>[]): ChartConfiguration['data'] {
		if (amounts.length === 0) return {datasets: []};
		const color = this.chartService.getAssetColor(this.unit(), 0);
		const muted_color = this.chartService.getMutedColor(color.border, 0.5);
		const data_prepped = amounts
			.map((amount) => ({
				x: amount['created_time'] * 1000,
				y: toDisplayAmount(this.unit(), amount['amount']),
			}))
			.sort((a, b) => a.x - b.x);
		const dataset = {
			label: this.unit().toUpperCase(),
			data: data_prepped,
			backgroundColor: muted_color,
			borderColor: muted_color,
			pointBackgroundColor: muted_color,
			pointBorderColor: muted_color,
			pointBorderWidth: 1,
			pointHoverBackgroundColor: this.chartService.getPointHoverBackgroundColor(),
			pointHoverBorderColor: color.border,
			pointHoverBorderWidth: 2,
			pointRadius: 3,
			pointHoverRadius: 5,
		};
		return {datasets: [dataset]};
	}

	private getChartOptions(): ChartConfiguration['options'] {
		const chart_data = this.chart_data();
		if (!chart_data || chart_data.datasets.length === 0) return {};
		const data = (chart_data.datasets[0]?.data as {x: number; y: number}[]) || [];
		const min_time = data.length ? Math.min(...data.map((d) => d.x)) : Date.now();
		const max_time = data.length ? Math.max(...data.map((d) => d.x)) : Date.now();
		const span_days = (max_time - min_time) / (1000 * 60 * 60 * 24);
		const time_unit = span_days > 90 ? 'month' : span_days > 21 ? 'week' : 'day';
		const use_log_scale = this.stats().max / this.stats().min >= 100;
		const step_size = 1;

		const scales: any = {};
		scales['x'] = {
			type: 'time',
			time: {
				unit: time_unit,
				stepSize: step_size,
				displayFormats: {
					month: 'MMM yyyy',
					week: 'MMM d',
					day: 'MMM d',
				},
			},
			display: false,
			min: min_time,
			max: max_time,
		};
		const y_max = Math.max(toDisplayAmount(this.unit(), this.stats().max), this.max_amount());
		scales['y'] = {
			type: use_log_scale ? 'logarithmic' : 'linear',
			min: use_log_scale ? 1 : undefined,
			max: y_max,
			display: false,
			beginAtZero: !use_log_scale,
		};

		return {
			responsive: true,
			elements: {
				point: {
					radius: 3,
					hoverRadius: 5,
					borderWidth: 1,
					hoverBorderWidth: 2,
				},
			},
			scales: scales,
			plugins: {
				tooltip: {
					enabled: true,
					mode: 'nearest',
					intersect: true,
					callbacks: {
						title: getTooltipTitleExact,
						label: (context: any) => getTooltipLabel(context, this.locale()),
					},
				},
				legend: {
					display: false,
				},
			},
			interaction: {
				mode: 'nearest',
				intersect: true,
			},
			animation: {
				duration: 750,
				easing: 'easeOutQuart',
			},
		};
	}

	private getFormAnnotation(): any {
		const min_config = this.chartService.getFormAnnotationConfig(this.min_hot());
		const max_config = this.chartService.getFormAnnotationConfig(this.max_hot());
		return {
			annotations: {
				min: {
					type: 'line',
					borderColor: min_config.border_color,
					borderWidth: min_config.border_width,
					display: true,
					label: {
						display: true,
						content: 'Min Amount',
						position: 'start',
						backgroundColor: min_config.label_bg_color,
						color: min_config.text_color,
						font: {
							size: 12,
							weight: '300',
						},
						borderColor: min_config.label_border_color,
						borderWidth: 1,
					},
					scaleID: 'y',
					value: this.min_amount(),
				},
				max: {
					type: 'line',
					borderColor: max_config.border_color,
					borderWidth: max_config.border_width,
					display: true,
					label: {
						display: true,
						content: 'Max Amount',
						position: 'start',
						backgroundColor: max_config.label_bg_color,
						color: max_config.text_color,
						font: {
							size: 12,
							weight: '300',
						},
						borderColor: max_config.label_border_color,
						borderWidth: 1,
					},
					scaleID: 'y',
					value: this.max_amount(),
				},
			},
		};
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
		if (this.resize_timeout) clearTimeout(this.resize_timeout);
	}
}
