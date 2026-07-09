/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, signal} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration} from 'chart.js';

interface ChartLegendEntry {
	index: number;
	label: string;
	leaf: string;
	color: string;
	dashed: boolean;
}

interface ChartLegendGroup {
	key: string;
	entries: ChartLegendEntry[];
}

// Series labels join their parts with this separator (e.g. `get_settings · success · p50`)
const LEGEND_SEPARATOR = ' · ';

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
	public readonly groups = computed<ChartLegendGroup[]>(() => this.buildGroups());
	private readonly hidden = signal<Set<number>>(new Set());

	/** Whether the given series index is currently toggled off */
	public isHidden(index: number): boolean {
		return this.hidden().has(index);
	}

	/** Whether every series in a group is currently toggled off */
	public isGroupHidden(group: ChartLegendGroup): boolean {
		return group.entries.every((entry) => this.hidden().has(entry.index));
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

	/** Toggles visibility of every series in a group, driving them all to the same state */
	public onToggleGroup(group: ChartLegendGroup): void {
		const chart = this.chart()?.chart;
		if (!chart) return;
		const hide = !this.isGroupHidden(group);
		const hidden = new Set(this.hidden());
		for (const entry of group.entries) {
			if (hidden.has(entry.index) === hide) continue;
			if (this.datapoint_mode()) chart.toggleDataVisibility(entry.index);
			else chart.setDatasetVisibility(entry.index, !hide);
			if (hide) hidden.add(entry.index);
			else hidden.delete(entry.index);
		}
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
				leaf: this.getLeaf(String(label)),
				color: Array.isArray(colors) ? colors[index] : (colors ?? ''),
				dashed: false,
			}));
		}
		return (data.datasets ?? []).map((dataset, index) => ({
			index,
			label: dataset.label ?? '',
			leaf: this.getLeaf(dataset.label ?? ''),
			color: typeof dataset.borderColor === 'string' ? dataset.borderColor : '',
			dashed:
				Array.isArray((dataset as {borderDash?: number[]}).borderDash) && (dataset as {borderDash: number[]}).borderDash.length > 0,
		}));
	}

	/** Groups entries by their shared label prefix; series sharing a prefix collapse into one column */
	private buildGroups(): ChartLegendGroup[] {
		const groups: ChartLegendGroup[] = [];
		const group_index = new Map<string, number>();
		for (const entry of this.entries()) {
			const key = this.getGroupKey(entry.label);
			const existing = group_index.get(key);
			if (existing === undefined) {
				group_index.set(key, groups.length);
				groups.push({key, entries: [entry]});
			} else {
				groups[existing].entries.push(entry);
			}
		}
		return groups;
	}

	/** The label prefix shared by a series' variants, or the full label when it has no separator */
	private getGroupKey(label: string): string {
		const index = label.lastIndexOf(LEGEND_SEPARATOR);
		return index === -1 ? label : label.slice(0, index);
	}

	/** The trailing label segment (e.g. `p50`), or the full label when it has no separator */
	private getLeaf(label: string): string {
		const index = label.lastIndexOf(LEGEND_SEPARATOR);
		return index === -1 ? label : label.slice(index + LEGEND_SEPARATOR.length);
	}
}
