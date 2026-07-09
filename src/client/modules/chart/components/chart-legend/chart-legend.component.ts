/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, signal} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration} from 'chart.js';

interface ChartLegendEntry {
	index: number;
	label: string;
	color: string;
	dashed: boolean;
}

@Component({
	selector: 'orc-chart-legend',
	standalone: false,
	templateUrl: './chart-legend.component.html',
	styleUrl: './chart-legend.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartLegendComponent {
	public readonly chart = input<BaseChartDirective | undefined>(undefined);
	public readonly chart_data = input<ChartConfiguration['data'] | undefined>(undefined);
	// Pie/doughnut charts encode series as data points in one dataset rather than separate datasets
	public readonly datapoint_mode = input<boolean>(false);

	public readonly entries = computed<ChartLegendEntry[]>(() => this.buildEntries());
	private readonly hidden = signal<Set<number>>(new Set());

	/** Whether the given series index is currently toggled off */
	public isHidden(index: number): boolean {
		return this.hidden().has(index);
	}

	/** Toggles a series' visibility on the chart and dims its legend entry */
	public onToggle(entry: ChartLegendEntry): void {
		const chart = this.chart()?.chart;
		if (!chart) return;
		const hidden = new Set(this.hidden());
		if (this.datapoint_mode()) chart.toggleDataVisibility(entry.index);
		else chart.setDatasetVisibility(entry.index, hidden.has(entry.index));
		if (hidden.has(entry.index)) hidden.delete(entry.index);
		else hidden.add(entry.index);
		this.hidden.set(hidden);
		chart.update();
	}

	/** Derives one legend entry per series from the chart data (datasets, or data points in pie mode) */
	private buildEntries(): ChartLegendEntry[] {
		const data = this.chart_data();
		if (!data) return [];
		if (this.datapoint_mode()) {
			const dataset = data.datasets?.[0] as {backgroundColor?: string | string[]} | undefined;
			const colors = dataset?.backgroundColor;
			return (data.labels ?? []).map((label, index) => ({
				index,
				label: String(label),
				color: Array.isArray(colors) ? colors[index] : (colors ?? ''),
				dashed: false,
			}));
		}
		return (data.datasets ?? []).map((dataset, index) => ({
			index,
			label: dataset.label ?? '',
			color: typeof dataset.borderColor === 'string' ? dataset.borderColor : '',
			dashed:
				Array.isArray((dataset as {borderDash?: number[]}).borderDash) && (dataset as {borderDash: number[]}).borderDash.length > 0,
		}));
	}
}
