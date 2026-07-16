/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input, viewChild} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration} from 'chart.js';
/* Application Dependencies */
import {ChartService} from '@client/modules/chart/services/chart/chart.service';

export interface ChartPieSlice {
	label: string;
	value: number;
}

@Component({
	selector: 'orc-chart-pie',
	standalone: false,
	templateUrl: './chart-pie.component.html',
	styleUrl: './chart-pie.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartPieComponent {
	private readonly chartService = inject(ChartService);

	public readonly slices = input.required<ChartPieSlice[]>();

	public readonly chart = viewChild(BaseChartDirective);
	public readonly chart_type = 'doughnut' as const;

	public readonly has_data = computed<boolean>(() => this.slices().length > 0);

	public readonly chart_data = computed<ChartConfiguration<'doughnut'>['data']>(() => {
		const slices = this.slices();
		return {
			labels: slices.map((slice) => slice.label),
			datasets: [
				{
					data: slices.map((slice) => slice.value),
					backgroundColor: slices.map((_, index) => this.chartService.getCategoricalColor(index).border),
					borderWidth: 0,
				},
			],
		};
	});

	public readonly chart_options: ChartConfiguration<'doughnut'>['options'] = {
		responsive: true,
		maintainAspectRatio: false,
		cutout: '55%',
		plugins: {legend: {display: false}, tooltip: {enabled: true}},
	};
}
