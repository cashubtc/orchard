/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output, effect, signal, untracked, viewChild, OnDestroy} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration, ChartType as ChartJsType, Plugin} from 'chart.js';
import {DateTime} from 'luxon';
import {Subscription} from 'rxjs';
/* Application Dependencies */
import {ChartService} from '@client/modules/chart/services/chart/chart.service';
import {formatAxisValue} from '@client/modules/chart/helpers/mint-chart-options.helpers';
/* Native Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';

@Component({
	selector: 'orc-bitcoin-subsection-oracle-chart',
	standalone: false,
	templateUrl: './bitcoin-subsection-oracle-chart.component.html',
	styleUrl: './bitcoin-subsection-oracle-chart.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitcoinSubsectionOracleChartComponent implements OnDestroy {
	public chart = viewChild(BaseChartDirective);

	public locale = input.required<string>();
	public loading = input.required<boolean>();
	public data = input.required<BitcoinOraclePrice[]>();
	public date_today = input.required<number>();
	public date_start = input.required<number>();
	public date_end = input.required<number>();
	public backfill_date_start = input.required<number | null>();
	public backfill_date_end = input.required<number | null>();
	public form_open = input.required<boolean>();
	public enabled_ai = input.required<boolean>();

	public backfill_date = output<number>();

	public chart_type = signal<ChartJsType>('line');
	public chart_data = signal<ChartConfiguration['data']>({datasets: []});
	public chart_options = signal<ChartConfiguration['options']>({});
	public chart_plugins = signal<Plugin[]>([]);
	public displayed = signal<boolean>(false);
	public animations_embedded_enabled = signal<boolean>(false);

	private subscriptions: Subscription = new Subscription();
	private animations_chart_enabled: boolean = true;

	constructor(private chartService: ChartService) {
		this.subscriptions.add(this.getRemoveSubscription());
		this.subscriptions.add(this.getAddSubscription());
		effect(() => {
			const done_loading = !this.loading();
			if (done_loading) this.init();
		});
		effect(() => {
			// React to changes in form state and backfill dates
			this.form_open();
			this.backfill_date_start();
			this.backfill_date_end();

			if (!this.loading() && this.form_open() && this.backfill_date_start() !== null) {
				untracked(() => this.init());
			}
		});
		setTimeout(() => {
			this.animations_embedded_enabled.set(true);
		}, 100);
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
		if (this.loading()) return;
		this.chart_type.set('line');
		this.chart_data.set(this.getChartData());
		this.chart_options.set(this.getChartOptions());
		this.initGlowPlugin();
		this.animations_chart_enabled = false;
		setTimeout(() => {
			this.chart()?.chart?.resize();
		});
		setTimeout(() => {
			this.displayed.set(true);
		}, 50);
	}

	/**
	 * Creates the glow effect plugin for chart points (line charts only)
	 */
	private initGlowPlugin(): void {
		const chart_data = this.chart_data();
		if (!chart_data?.datasets || chart_data.datasets.length === 0) {
			this.chart_plugins.set([]);
			return;
		}
		const first_color = chart_data.datasets[0]?.borderColor as string;
		this.chart_plugins.set(first_color ? [this.chartService.createGlowPlugin(first_color)] : []);
	}

	/**
	 * Transforms BitcoinOraclePrice data into Chart.js format
	 * @returns {ChartConfiguration['data']} Chart data with x/y coordinates
	 */
	private getChartData(): ChartConfiguration['data'] {
		const price_data = this.data();

		if (!price_data || price_data.length === 0) {
			return {datasets: []};
		}

		// Convert data to {x, y} format where x is milliseconds at midnight UTC and y is price
		const formatted_data = price_data.map((point) => ({
			x: DateTime.fromSeconds(point.date, {zone: 'utc'}).startOf('day').toMillis(),
			y: point.price,
		}));

		// Sort by date to ensure proper line rendering
		formatted_data.sort((a, b) => a.x - b.x);

		const color = this.chartService.getAssetColor('usd', 0);

		// Calculate interpolated data for missing dates
		const interpolated_data = this.getInterpolatedData(formatted_data);

		// Split data into chunks based on missing days
		const data_chunks = this.splitDataIntoChunks(formatted_data);

		const datasets: any[] = [];

		// Create a separate dataset for each continuous chunk of data
		const muted_color = this.chartService.getMutedColor(color.border);
		for (const chunk of data_chunks) {
			datasets.push({
				label: 'BTC/USD',
				data: chunk,
				backgroundColor: (context: any) => this.chartService.createAreaGradient(context, color.border),
				borderColor: muted_color,
				borderWidth: 2,
				pointBackgroundColor: muted_color,
				pointBorderColor: muted_color,
				pointBorderWidth: 2,
				pointHoverBackgroundColor: this.chartService.getPointHoverBackgroundColor(),
				pointHoverBorderColor: color.border,
				pointHoverBorderWidth: 3,
				pointRadius: 0,
				pointHoverRadius: 5,
				fill: true,
				tension: 0.4,
				yAxisID: 'y',
			});
		}

		// Add interpolated dataset if there are missing dates
		if (interpolated_data.length > 0) {
			datasets.push({
				label: 'BTC/USD (Estimated)',
				data: interpolated_data,
				backgroundColor: 'rgba(128, 128, 128, 0.5)',
				borderColor: 'rgba(128, 128, 128, 0.8)',
				pointBackgroundColor: 'rgba(128, 128, 128, 0.8)',
				pointBorderColor: 'rgba(128, 128, 128, 0.8)',
				pointHoverBackgroundColor: 'rgba(128, 128, 128, 1)',
				pointHoverBorderColor: 'rgba(128, 128, 128, 1)',
				pointRadius: 2,
				pointHoverRadius: 5,
				showLine: false,
				yAxisID: 'y',
			});
		}

		return {
			datasets: datasets,
		};
	}

	/**
	 * Splits data into separate chunks when there are missing days between consecutive points
	 * @param {Array<{x: number, y: number}>} formatted_data - Sorted array of data points
	 * @returns {Array<Array<{x: number, y: number}>>} Array of data chunks, each representing continuous data
	 */
	private splitDataIntoChunks(formatted_data: Array<{x: number; y: number}>): Array<Array<{x: number; y: number}>> {
		if (formatted_data.length === 0) {
			return [];
		}

		const chunks: Array<Array<{x: number; y: number}>> = [];
		let current_chunk: Array<{x: number; y: number}> = [formatted_data[0]];

		const one_day_ms = 86400000; // 24 hours in milliseconds

		for (let i = 1; i < formatted_data.length; i++) {
			const previous_point = formatted_data[i - 1];
			const current_point = formatted_data[i];

			// Check if there's a gap (more than 1 day) between consecutive points
			const time_diff = current_point.x - previous_point.x;

			if (time_diff > one_day_ms) {
				// Gap detected - save current chunk and start a new one
				chunks.push(current_chunk);
				current_chunk = [current_point];
			} else {
				// No gap - add to current chunk
				current_chunk.push(current_point);
			}
		}

		// Don't forget to add the last chunk
		if (current_chunk.length > 0) {
			chunks.push(current_chunk);
		}

		return chunks;
	}

	/**
	 * Calculates interpolated values for missing dates in the data range
	 * @param {Array<{x: number, y: number}>} formatted_data - Sorted array of existing data points
	 * @returns {Array<{x: number, y: number, is_today?: boolean}>} Array of interpolated pointsmaintainAspectRatio
	 */
	private getInterpolatedData(formatted_data: Array<{x: number; y: number}>): Array<{x: number; y: number; is_today?: boolean}> {
		if (formatted_data.length === 0) {
			return [];
		}

		const start_date = DateTime.fromSeconds(this.date_start(), {zone: 'utc'}).startOf('day');
		const end_date = DateTime.fromSeconds(this.date_end(), {zone: 'utc'}).startOf('day');
		const today = DateTime.utc().startOf('day');

		// Create a Set of existing dates for quick lookup
		const existing_dates = new Set(formatted_data.map((point) => point.x));

		const interpolated_points: Array<{x: number; y: number; is_today?: boolean}> = [];

		// Iterate through each day in the range
		let current_date = start_date;
		while (current_date <= end_date) {
			const current_millis = current_date.toMillis();

			// Check if this date is missing from the actual data
			if (!existing_dates.has(current_millis)) {
				const interpolated_value = this.calculateInterpolatedValue(current_millis, formatted_data);

				if (interpolated_value !== null) {
					const point: {x: number; y: number; is_today?: boolean} = {
						x: current_millis,
						y: interpolated_value,
					};

					// Mark if this is today's date
					if (current_date.equals(today)) {
						point.is_today = true;
					}

					interpolated_points.push(point);
				}
			}

			current_date = current_date.plus({days: 1});
		}

		return interpolated_points;
	}

	/**
	 * Calculates the interpolated price value for a missing date
	 * @param {number} target_millis - The timestamp in milliseconds for the missing date
	 * @param {Array<{x: number, y: number}>} formatted_data - Sorted array of existing data points
	 * @returns {number | null} The interpolated price value or null if cannot be calculated
	 */
	private calculateInterpolatedValue(target_millis: number, formatted_data: Array<{x: number; y: number}>): number | null {
		// Find the closest data points before and after the target date
		let before_point: {x: number; y: number} | null = null;
		let after_point: {x: number; y: number} | null = null;

		for (const point of formatted_data) {
			if (point.x < target_millis) {
				before_point = point;
			} else if (point.x > target_millis) {
				if (after_point === null) {
					after_point = point;
				}
				break;
			}
		}

		// a) Only data before the target date exists
		if (before_point && !after_point) {
			return before_point.y;
		}

		// b) Data exists both before and after - linear interpolation
		if (before_point && after_point) {
			const time_diff = after_point.x - before_point.x;
			const value_diff = after_point.y - before_point.y;
			const time_from_before = target_millis - before_point.x;

			return before_point.y + (value_diff * time_from_before) / time_diff;
		}

		// c) Only data after the target date exists
		if (!before_point && after_point) {
			return after_point.y;
		}

		return null;
	}

	/**
	 * Configures chart display options including scales, tooltips, and legend
	 * @returns {ChartConfiguration['options']} Chart configuration options
	 */
	private getChartOptions(): ChartConfiguration['options'] {
		if (!this.chart_data() || this.chart_data().datasets.length === 0) {
			return {};
		}

		const scales: any = {
			x: {
				type: 'time',
				time: {
					unit: 'day',
					displayFormats: {
						day: 'MMM d',
					},
					tooltipFormat: 'PPP',
				},
				adapters: {
					date: {
						zone: 'UTC',
					},
				},
				ticks: {
					source: 'data',
					callback: (value: any) => {
						return DateTime.fromMillis(value, {zone: 'utc'}).toFormat('MMM d');
					},
				},
				bounds: 'data',
				title: {
					display: true,
					text: 'Date (UTC)',
				},
				grid: {
					display: false,
				},
			},
			y: {
				position: 'left',
				title: {
					display: true,
					text: 'Price (USD)',
				},
				beginAtZero: false,
				grid: {
					display: true,
					color: this.chartService.getGridColor(),
				},
				ticks: {
					callback: (value: string | number) => {
						return formatAxisValue(Number(value), this.locale());
					},
				},
			},
		};

		// Build annotations for backfill range
		const annotations: any = {};

		if (this.form_open() && this.backfill_date_start() !== null) {
			const start_millis = DateTime.fromSeconds(this.backfill_date_start()!, {zone: 'utc'}).startOf('day').toMillis();
			const end_date = this.backfill_date_end();
			const config = this.chartService.getFormAnnotationConfig(true);

			if (end_date !== null) {
				// Draw a rectangle for the range
				const end_millis = DateTime.fromSeconds(end_date, {zone: 'utc'}).startOf('day').toMillis();

				annotations.backfill_range = {
					type: 'box',
					xMin: start_millis,
					xMax: end_millis,
					backgroundColor: this.chartService.hexToRgba(config.label_bg_color, 0.25),
					borderColor: this.chartService.hexToRgba(config.label_bg_color, 0.8),
					borderWidth: 2,
					borderDash: [5, 5],
					label: {
						display: true,
						content: 'Backfill Dates',
						position: 'middle',
						color: config.text_color,
						font: {
							size: 12,
							weight: '300',
						},
					},
				};
			} else {
				// Draw a vertical line for just the start date
				annotations.backfill_line = {
					type: 'line',
					scaleID: 'x',
					value: start_millis,
					borderColor: this.chartService.hexToRgba(config.label_bg_color, 0.8),
					borderWidth: 2,
					borderDash: [5, 5],
					label: {
						display: true,
						content: 'Backfill Date',
						position: 'middle',
						backgroundColor: this.chartService.hexToRgba(config.label_bg_color, 0.5),
						color: config.text_color,
						font: {
							size: 12,
							weight: '300',
						},
						borderColor: config.label_border_color,
						borderWidth: 1,
					},
				};
			}
		}

		const chart_options: ChartConfiguration['options'] = {
			maintainAspectRatio: false,
			onClick: (event: any, elements: any[]) => {
				if (elements.length > 0) {
					const clicked_element = elements[0];
					const dataset_index = clicked_element.datasetIndex;
					const data_index = clicked_element.index;
					const dataset = this.chart_data().datasets[dataset_index];
					const data_point = dataset.data[data_index] as {x: number; y: number};
					const date_unix = Math.floor(data_point.x / 1000);
					this.backfill_date.emit(date_unix);
				}
			},
			onHover: (event: any, elements: any[]) => {
				const canvas = event.native?.target as HTMLCanvasElement;
				if (canvas) {
					if (elements.length > 0) {
						const hovered_element = elements[0];
						const dataset = this.chart_data().datasets[hovered_element.datasetIndex];
						// Only show pointer cursor for interpolated data
						if (dataset.label === 'BTC/USD (Estimated)') {
							canvas.style.cursor = 'pointer';
						} else {
							canvas.style.cursor = 'default';
						}
					} else {
						canvas.style.cursor = 'default';
					}
				}
			},
			elements: {
				line: {
					tension: 0.4,
					cubicInterpolationMode: 'monotone',
				},
			},
			scales: scales,
			plugins: {
				annotation: {
					annotations: annotations,
				},
				tooltip: {
					enabled: true,
					mode: 'nearest',
					intersect: false,
					callbacks: {
						title: (tooltipItems: any) => {
							if (tooltipItems.length > 0) {
								return DateTime.fromMillis(tooltipItems[0].parsed.x, {zone: 'utc'}).toLocaleString({
									year: 'numeric',
									month: 'short',
									day: 'numeric',
								});
							}
							return '';
						},
						label: (context: any) => {
							const value = context.parsed.y;
							const is_interpolated = context.dataset.label === 'BTC/USD (Estimated)';

							// For interpolated points, only show the status message
							if (is_interpolated) {
								const data_point = context.dataset.data[context.dataIndex];
								const today = DateTime.utc().startOf('day').toMillis();

								if (data_point.is_today || data_point.x === today) {
									return 'Calculated after UTC day close';
								} else {
									return 'Missing data';
								}
							}

							// For actual data points, show the price
							const price_label = `${context.dataset.label}: $${value.toLocaleString(this.locale(), {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}`;

							return price_label;
						},
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
		if (!this.animations_chart_enabled) chart_options.animation = false;
		return chart_options;
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
