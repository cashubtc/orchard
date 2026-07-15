/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcChartModule} from '@client/modules/chart/chart.module';
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Local Dependencies */
import {ChartLegendComponent} from './chart-legend.component';

/** Builds a minimal ng2-charts stand-in exposing the Chart.js instance the legend drives */
function mockChart(datasets: {borderColor?: unknown; backgroundColor?: unknown}[]): any {
	const chart = {
		data: {datasets},
		setDatasetVisibility: jasmine.createSpy('setDatasetVisibility'),
		toggleDataVisibility: jasmine.createSpy('toggleDataVisibility'),
		update: jasmine.createSpy('update'),
	};
	return {chart};
}

const PERCENTILE_DATASETS = [
	{label: 'mint · p50', borderColor: '#111111', borderDash: [4, 4]},
	{label: 'mint · p95', borderColor: '#111111', borderDash: []},
	{label: 'mint · p99', borderColor: '#111111', borderDash: [1, 3]},
	{label: 'melt · p50', borderColor: '#222222', borderDash: [4, 4]},
	{label: 'melt · p95', borderColor: '#222222', borderDash: []},
	{label: 'melt · p99', borderColor: '#222222', borderDash: [1, 3]},
];

describe('ChartLegendComponent', () => {
	let component: ChartLegendComponent;
	let fixture: ComponentFixture<ChartLegendComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcChartModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(ChartLegendComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('chart_data', {datasets: []});
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('builds one entry per dataset, carrying each series borderDash', () => {
		fixture.componentRef.setInput('chart_data', {datasets: PERCENTILE_DATASETS.slice(0, 3)});
		const entries = component.entries();
		expect(entries.length).toBe(3);
		expect(entries[0]).toEqual({index: 0, label: 'mint · p50', leaf: 'p50', color: '#111111', dash: [4, 4], dash_array: '4 4'});
		expect(entries[1].dash).toEqual([]);
		expect(entries[2].dash).toEqual([1, 3]);
	});

	it('renders distinct dash arrays so p50 and p99 no longer collapse to one appearance', () => {
		expect(component.dashArray([4, 4])).toBe('4 4');
		expect(component.dashArray([1, 3])).toBe('1 3');
		expect(component.dashArray([])).toBeNull();
	});

	it('shows bulk controls only on the dataset-heavy layouts', () => {
		fixture.componentRef.setInput('layout', 'wrap');
		expect(component.show_controls()).toBe(false);
		fixture.componentRef.setInput('layout', 'list');
		expect(component.show_controls()).toBe(true);
		fixture.componentRef.setInput('layout', 'matrix');
		expect(component.show_controls()).toBe(true);
	});

	it('collapses series that share a label prefix into one group, keyed by the prefix', () => {
		fixture.componentRef.setInput('chart_data', {datasets: PERCENTILE_DATASETS});
		const groups = component.groups();
		expect(groups.map((group) => group.key)).toEqual(['mint', 'melt']);
		expect(groups[0].entries.map((entry) => entry.leaf)).toEqual(['p50', 'p95', 'p99']);
		expect(component.groupIndices(groups[0])).toEqual([0, 1, 2]);
	});

	it('derives the ordered variant leaves from multi-series groups', () => {
		fixture.componentRef.setInput('chart_data', {datasets: PERCENTILE_DATASETS});
		expect(component.leaves()).toEqual(['p50', 'p95', 'p99']);
	});

	it('filters legend groups by query without touching chart visibility', () => {
		fixture.componentRef.setInput('chart_data', {datasets: PERCENTILE_DATASETS});
		component.onQuery('MELT');
		expect(component.filtered_groups().map((group) => group.key)).toEqual(['melt']);
		component.onQuery('');
		expect(component.filtered_groups().length).toBe(2);
	});

	it('keeps ungrouped series as singleton groups carrying their full label', () => {
		fixture.componentRef.setInput('chart_data', {
			datasets: [{label: 'memory', borderColor: '#111111'}],
		});
		const groups = component.groups();
		expect(groups.length).toBe(1);
		expect(groups[0].key).toBe('memory');
		expect(groups[0].entries[0].leaf).toBe('memory');
	});

	it('builds entries from labels and slice colors in datapoint mode', () => {
		fixture.componentRef.setInput('datapoint_mode', true);
		fixture.componentRef.setInput('chart_data', {
			labels: ['/mint', '/melt'],
			datasets: [{backgroundColor: ['#aaaaaa', '#bbbbbb'], data: [5, 3]}],
		});
		const entries = component.entries();
		expect(entries.map((entry) => entry.label)).toEqual(['/mint', '/melt']);
		expect(entries[1].color).toBe('#bbbbbb');
	});

	it('isolates one variant across every group and clears on re-click', () => {
		const datasets = PERCENTILE_DATASETS.map((dataset) => ({...dataset}));
		fixture.componentRef.setInput('chart_data', {datasets});
		const chart = mockChart(datasets);
		fixture.componentRef.setInput('chart', chart);

		component.onIsolate('p95');
		expect(component.isolated()).toBe('p95');
		expect(chart.chart.setDatasetVisibility).toHaveBeenCalledWith(0, false);
		expect(chart.chart.setDatasetVisibility).toHaveBeenCalledWith(1, true);
		expect(chart.chart.setDatasetVisibility).toHaveBeenCalledWith(2, false);
		expect(component.isHidden(0)).toBe(true);
		expect(component.isHidden(1)).toBe(false);

		component.onIsolate('p95');
		expect(component.isolated()).toBeNull();
		expect(component.isHidden(0)).toBe(false);
	});

	it('clears the active isolation when a series is toggled manually', () => {
		const datasets = PERCENTILE_DATASETS.map((dataset) => ({...dataset}));
		fixture.componentRef.setInput('chart_data', {datasets});
		fixture.componentRef.setInput('chart', mockChart(datasets));

		component.onIsolate('p50');
		expect(component.isolated()).toBe('p50');
		component.onToggle(component.entries()[0]);
		expect(component.isolated()).toBeNull();
	});

	it('dims non-highlighted series on hover and restores every series on hover end', () => {
		const datasets = [
			{borderColor: 'rgba(1, 2, 3, 0.6)', backgroundColor: 'rgba(1, 2, 3, 0.6)'},
			{borderColor: 'rgba(4, 5, 6, 0.6)', backgroundColor: 'rgba(4, 5, 6, 0.6)'},
		];
		fixture.componentRef.setInput('chart_data', {datasets});
		fixture.componentRef.setInput('chart', mockChart(datasets));

		component.onHover([0]);
		expect(datasets[0].borderColor).toBe('rgba(1, 2, 3, 0.6)');
		expect(datasets[1].borderColor).toBe('rgba(4, 5, 6, 0.1)');
		expect(datasets[1].backgroundColor).toBe('transparent');

		component.onHoverEnd();
		expect(datasets[1].borderColor).toBe('rgba(4, 5, 6, 0.6)');
		expect(datasets[1].backgroundColor).toBe('rgba(4, 5, 6, 0.6)');
	});

	it('toggles every series with select-all and select-none', () => {
		const datasets = [{borderColor: '#111111'}, {borderColor: '#222222'}];
		fixture.componentRef.setInput('chart_data', {datasets});
		const chart = mockChart(datasets);
		fixture.componentRef.setInput('chart', chart);

		component.hideAll();
		expect(chart.chart.setDatasetVisibility).toHaveBeenCalledWith(0, false);
		expect(chart.chart.setDatasetVisibility).toHaveBeenCalledWith(1, false);
		expect(component.isHidden(0)).toBe(true);

		component.showAll();
		expect(chart.chart.setDatasetVisibility).toHaveBeenCalledWith(0, true);
		expect(component.isHidden(0)).toBe(false);
	});

	it('maps a group and variant leaf to its dataset entry', () => {
		fixture.componentRef.setInput('chart_data', {datasets: PERCENTILE_DATASETS});
		const group = component.groups()[0];
		expect(component.entryFor(group, 'p95')?.index).toBe(1);
		expect(component.entryFor(group, 'missing')).toBeUndefined();
	});

	it('renders the matrix as a table with the group label and one column per variant', () => {
		fixture.componentRef.setInput('chart_data', {datasets: PERCENTILE_DATASETS});
		fixture.componentRef.setInput('layout', 'matrix');
		fixture.componentRef.setInput('group_label', 'operation');
		fixture.detectChanges();
		expect(component.matrix_columns()).toEqual(['series', 'p50', 'p95', 'p99']);
		const header_cells = fixture.nativeElement.querySelectorAll('.chart-legend-matrix-table th.mat-mdc-header-cell');
		expect(Array.from(header_cells).map((cell: any) => cell.textContent.trim())).toEqual(['operation', 'p50', 'p95', 'p99']);
		const rows = fixture.nativeElement.querySelectorAll('.chart-legend-matrix-table tr.mat-mdc-row');
		expect(rows.length).toBe(2);
	});
});
