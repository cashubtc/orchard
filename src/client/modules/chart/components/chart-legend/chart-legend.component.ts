/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input, signal} from '@angular/core';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {ChartConfiguration} from 'chart.js';
/* Application Dependencies */
import {ChartService} from '@client/modules/chart/services/chart/chart.service';

type ChartLegendLayout = 'wrap' | 'list' | 'matrix';

interface ChartLegendEntry {
	index: number;
	label: string;
	leaf: string;
	color: string;
	dash: number[];
	// Precomputed SVG stroke-dasharray for the matrix line, null when solid
	dash_array: string | null;
}

interface ChartLegendGroup {
	key: string;
	entries: ChartLegendEntry[];
	// Leaf name → entry, for O(1) matrix-cell lookup
	by_leaf: Map<string, ChartLegendEntry>;
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
	private readonly chartService = inject(ChartService);

	public readonly chart = input<BaseChartDirective | undefined>(undefined);
	public readonly chart_data = input<ChartConfiguration['data'] | undefined>(undefined);
	// Pie/doughnut charts encode series as data points in one dataset rather than separate datasets
	public readonly datapoint_mode = input<boolean>(false);
	// `wrap`: compact centered row (few, constrained series); `list`: aligned columns (many single series);
	// `matrix`: table of series rows with one line-style cell per variant (p50/p95/p99)
	public readonly layout = input<ChartLegendLayout>('wrap');
	// Header label above the series-name column in the matrix layout
	public readonly group_label = input<string>('series');

	public readonly entries = computed<ChartLegendEntry[]>(() => this.buildEntries());
	public readonly groups = computed<ChartLegendGroup[]>(() => this.buildGroups());
	public readonly filtered_groups = computed<ChartLegendGroup[]>(() => this.buildFilteredGroups());
	// Unique trailing label segments across multi-series groups, in first-seen order (e.g. p50/p95/p99)
	public readonly leaves = computed<string[]>(() => this.buildLeaves());
	// Matrix table columns: the series-name column followed by one column per variant
	public readonly matrix_columns = computed<string[]>(() => ['series', ...this.leaves()]);
	// Bulk controls earn their space only on the dataset-heavy layouts
	public readonly show_controls = computed<boolean>(() => this.layout() === 'list' || this.layout() === 'matrix');
	// Group keys whose every series is hidden, for O(1) group-hidden checks in the template
	public readonly hidden_groups = computed<Set<string>>(() => {
		const hidden = this.hidden();
		return new Set(this.groups().filter((group) => group.entries.every((entry) => hidden.has(entry.index))).map((group) => group.key));
	});
	// Isolated variant leaf, or null when no isolation is active
	public readonly isolated = signal<string | null>(null);

	private readonly hidden = signal<Set<number>>(new Set());
	private readonly query = signal<string>('');
	// Original per-dataset styles captured on hover start, restored on hover end
	private original_styles = new Map<number, {border: unknown; background: unknown}>();

	/** Whether the given series index is currently toggled off */
	public isHidden(index: number): boolean {
		return this.hidden().has(index);
	}

	/** Whether every series in a group is currently toggled off */
	public isGroupHidden(group: ChartLegendGroup): boolean {
		return this.hidden_groups().has(group.key);
	}

	/** The dataset indices belonging to a group */
	public groupIndices(group: ChartLegendGroup): number[] {
		return group.entries.map((entry) => entry.index);
	}

	/** The entry within a group carrying the given variant leaf, or undefined when absent */
	public entryFor(group: ChartLegendGroup, leaf: string): ChartLegendEntry | undefined {
		return group.by_leaf.get(leaf);
	}

	/** Renders a dash pattern as an SVG `stroke-dasharray`, or null for a solid line */
	public dashArray(dash: number[]): string | null {
		return dash.length ? dash.join(' ') : null;
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Narrows the visible legend entries to those matching the query */
	public onQuery(value: string): void {
		this.query.set(value.trim().toLowerCase());
	}

	/** Toggles a series' visibility on the chart and dims its legend entry */
	public onToggle(entry: ChartLegendEntry): void {
		const chart = this.chart()?.chart;
		if (!chart) return;
		this.isolated.set(null);
		const hidden = new Set(this.hidden());
		const visible = hidden.has(entry.index);
		this.setEntryVisibility(chart, entry.index, visible);
		if (visible) hidden.delete(entry.index);
		else hidden.add(entry.index);
		this.hidden.set(hidden);
		chart.update();
	}

	/** Toggles visibility of every series in a group, driving them all to the same state */
	public onToggleGroup(group: ChartLegendGroup): void {
		const chart = this.chart()?.chart;
		if (!chart) return;
		this.isolated.set(null);
		const hide = !this.isGroupHidden(group);
		const hidden = new Set(this.hidden());
		for (const entry of group.entries) {
			if (hidden.has(entry.index) === hide) continue;
			this.setEntryVisibility(chart, entry.index, !hide);
			if (hide) hidden.add(entry.index);
			else hidden.delete(entry.index);
		}
		this.hidden.set(hidden);
		chart.update();
	}

	/** Reveals every series */
	public showAll(): void {
		this.isolated.set(null);
		this.setAllVisibility(true);
	}

	/** Hides every series */
	public hideAll(): void {
		this.isolated.set(null);
		this.setAllVisibility(false);
	}

	/** Shows only the series of one variant (e.g. p95) across every group; re-clicking clears the isolation */
	public onIsolate(leaf: string): void {
		const chart = this.chart()?.chart;
		if (!chart) return;
		const next = this.isolated() === leaf ? null : leaf;
		this.isolated.set(next);
		const isolatable = new Set(this.leaves());
		const hidden = new Set<number>();
		for (const entry of this.entries()) {
			const hide = next !== null && isolatable.has(entry.leaf) && entry.leaf !== next;
			this.setEntryVisibility(chart, entry.index, !hide);
			if (hide) hidden.add(entry.index);
		}
		this.hidden.set(hidden);
		chart.update();
	}

	/** Highlights the given series on the chart, dimming the rest */
	public onHover(indices: number[]): void {
		const chart = this.chart()?.chart;
		if (!chart) return;
		const highlight = new Set(indices);
		const datasets = chart.data.datasets as {borderColor?: unknown; backgroundColor?: unknown}[];
		// Recapture when the chart was rebuilt since the last hover
		if (this.original_styles.size !== datasets.length) {
			this.original_styles = new Map(datasets.map((dataset, index) => [index, {border: dataset.borderColor, background: dataset.backgroundColor}]));
		}
		datasets.forEach((dataset, index) => {
			const original = this.original_styles.get(index);
			if (!original) return;
			if (highlight.has(index)) {
				dataset.borderColor = original.border;
				dataset.backgroundColor = original.background;
			} else {
				dataset.borderColor = this.dim(original.border);
				dataset.backgroundColor = 'transparent';
			}
		});
		chart.update();
	}

	/** Restores every series to its original style */
	public onHoverEnd(): void {
		const chart = this.chart()?.chart;
		if (!chart || this.original_styles.size === 0) return;
		const datasets = chart.data.datasets as {borderColor?: unknown; backgroundColor?: unknown}[];
		datasets.forEach((dataset, index) => {
			const original = this.original_styles.get(index);
			if (!original) return;
			dataset.borderColor = original.border;
			dataset.backgroundColor = original.background;
		});
		this.original_styles.clear();
		chart.update();
	}

	/* *******************************************************
		Chart
	******************************************************** */

	/** Drives every series to the given visibility and syncs the hidden set */
	private setAllVisibility(visible: boolean): void {
		const chart = this.chart()?.chart;
		if (!chart) return;
		const hidden = new Set<number>();
		for (const entry of this.entries()) {
			this.setEntryVisibility(chart, entry.index, visible);
			if (!visible) hidden.add(entry.index);
		}
		this.hidden.set(hidden);
		chart.update();
	}

	/** Sets one series' visibility, honoring datapoint mode's toggle-only API */
	private setEntryVisibility(chart: NonNullable<BaseChartDirective['chart']>, index: number, visible: boolean): void {
		if (this.datapoint_mode()) {
			if (this.hidden().has(index) === visible) chart.toggleDataVisibility(index);
		} else {
			chart.setDatasetVisibility(index, visible);
		}
	}

	/** Fades a color to a faint dim, leaving non-string styles (e.g. gradient callbacks) untouched */
	private dim(color: unknown): unknown {
		if (typeof color !== 'string') return color;
		if (color.startsWith('rgba(')) return color.replace(/[\d.]+\)$/, '0.1)');
		if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', ', 0.1)');
		if (color.startsWith('#')) return this.chartService.hexToRgba(color, 0.1);
		return color;
	}

	/* *******************************************************
		Data
	******************************************************** */

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
				dash: [],
				dash_array: null,
			}));
		}
		return (data.datasets ?? []).map((dataset, index) => {
			const dash = (dataset as {borderDash?: number[]}).borderDash;
			const dash_pattern = Array.isArray(dash) ? dash : [];
			return {
				index,
				label: dataset.label ?? '',
				leaf: this.getLeaf(dataset.label ?? ''),
				color: typeof dataset.borderColor === 'string' ? dataset.borderColor : '',
				dash: dash_pattern,
				dash_array: this.dashArray(dash_pattern),
			};
		});
	}

	/** Groups entries by their shared label prefix; series sharing a prefix collapse into one row */
	private buildGroups(): ChartLegendGroup[] {
		const groups: ChartLegendGroup[] = [];
		const group_index = new Map<string, number>();
		for (const entry of this.entries()) {
			const key = this.getGroupKey(entry.label);
			const existing = group_index.get(key);
			if (existing === undefined) {
				group_index.set(key, groups.length);
				groups.push({key, entries: [entry], by_leaf: new Map([[entry.leaf, entry]])});
			} else {
				const group = groups[existing];
				group.entries.push(entry);
				if (!group.by_leaf.has(entry.leaf)) group.by_leaf.set(entry.leaf, entry);
			}
		}
		return groups;
	}

	/** The groups whose key matches the active filter query */
	private buildFilteredGroups(): ChartLegendGroup[] {
		const query = this.query();
		if (!query) return this.groups();
		return this.groups().filter((group) => group.key.toLowerCase().includes(query));
	}

	/** Unique leaf names across multi-series groups, in first-seen order */
	private buildLeaves(): string[] {
		const leaves: string[] = [];
		for (const group of this.groups()) {
			if (group.entries.length < 2) continue;
			for (const entry of group.entries) {
				if (!leaves.includes(entry.leaf)) leaves.push(entry.leaf);
			}
		}
		return leaves;
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
