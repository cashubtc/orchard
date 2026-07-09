/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcChartModule} from '@client/modules/chart/chart.module';
/* Local Dependencies */
import {ChartLegendComponent} from './chart-legend.component';

describe('ChartLegendComponent', () => {
	let component: ChartLegendComponent;
	let fixture: ComponentFixture<ChartLegendComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcChartModule],
		}).compileComponents();

		fixture = TestBed.createComponent(ChartLegendComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('chart_data', {datasets: []});
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('builds one entry per dataset, flagging dashed series from borderDash', () => {
		fixture.componentRef.setInput('chart_data', {
			datasets: [
				{label: 'mint · p50', borderColor: '#111111', borderDash: []},
				{label: 'mint · p95', borderColor: '#222222', borderDash: [4, 4]},
			],
		});
		const entries = component.entries();
		expect(entries.length).toBe(2);
		expect(entries[0]).toEqual({index: 0, label: 'mint · p50', leaf: 'p50', color: '#111111', dashed: false});
		expect(entries[1].dashed).toBe(true);
	});

	it('collapses series that share a label prefix into one group, keyed by the prefix', () => {
		fixture.componentRef.setInput('chart_data', {
			datasets: [
				{label: 'get_settings · success · p50', borderColor: '#111111'},
				{label: 'get_settings · success · p95', borderColor: '#222222'},
				{label: 'get_settings · success · p99', borderColor: '#333333'},
				{label: 'start · success · p50', borderColor: '#444444'},
			],
		});
		const groups = component.groups();
		expect(groups.map((group) => group.key)).toEqual(['get_settings · success', 'start · success']);
		expect(groups[0].entries.map((entry) => entry.leaf)).toEqual(['p50', 'p95', 'p99']);
		expect(groups[1].entries.length).toBe(1);
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
});
