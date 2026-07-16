/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
/* Vendor Dependencies */
import {ChartConfiguration} from 'chart.js';
/* Application Dependencies */
import {ChartService} from '@client/modules/chart/services/chart/chart.service';

@Component({
	selector: 'orc-chart-gauge',
	standalone: false,
	templateUrl: './chart-gauge.component.html',
	styleUrl: './chart-gauge.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartGaugeComponent {
	private readonly chartService = inject(ChartService);

	public readonly value = input.required<number | null>();
	public readonly unit = input<string>('%');
	public readonly locale = input<string>('en-US');
	// Value at/above which the arc turns amber, then red
	public readonly warn = input<number>(1);
	public readonly danger = input<number>(5);

	public readonly chart_type = 'doughnut' as const;

	/** Threshold colour for the filled arc and the centre value */
	public readonly color = computed<string>(() => {
		const value = this.value() ?? 0;
		if (value >= this.danger()) return '#FF5470';
		if (value >= this.warn()) return '#FFB020';
		return '#14E0B0';
	});

	public readonly display_value = computed<string>(() => {
		const value = this.value();
		if (value === null) return '—';
		const formatted = new Intl.NumberFormat(this.locale(), {maximumFractionDigits: 2}).format(value);
		return `${formatted}${this.unit()}`;
	});

	public readonly chart_data = computed<ChartConfiguration<'doughnut'>['data']>(() => {
		const value = Math.max(0, Math.min(100, this.value() ?? 0));
		return {
			datasets: [
				{
					data: [value, 100 - value],
					backgroundColor: [this.color(), this.chartService.getGridColor()],
					borderWidth: 0,
					circumference: 180,
					rotation: 270,
				},
			],
		};
	});

	public readonly chart_options: ChartConfiguration<'doughnut'>['options'] = {
		responsive: true,
		maintainAspectRatio: false,
		cutout: '72%',
		plugins: {legend: {display: false}, tooltip: {enabled: false}},
	};
}
