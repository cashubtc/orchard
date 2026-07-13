/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Application Dependencies */
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Native Dependencies */
import {OrcSystemModule} from '@client/modules/system/system.module';
import {SystemChartPoint} from '@client/modules/system/types/system.types';
/* Local Dependencies */
import {SystemChartComponent} from './system-chart.component';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

describe('SystemChartComponent', () => {
	let component: SystemChartComponent;
	let fixture: ComponentFixture<SystemChartComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcSystemModule, MatIconTestingModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(SystemChartComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('locale', 'en-US');
		fixture.componentRef.setInput('metrics', []);
		fixture.componentRef.setInput('interval', SystemMetricsInterval.Hour);
		fixture.componentRef.setInput('unit', 'count');
		fixture.componentRef.setInput('type', 'bar');
		fixture.componentRef.setInput('loading', true);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('builds three percentile datasets per series when percentiles is enabled', () => {
		const metrics: SystemChartPoint[] = [
			{
				metric: 'cdk_mint_operation_duration_seconds',
				labels: [{name: 'operation', value: 'swap'}],
				date: 3600,
				p50: 0.01,
				p95: 0.2,
				p99: 0.4,
			},
		];
		fixture.componentRef.setInput('type', 'line');
		fixture.componentRef.setInput('unit', 'seconds');
		fixture.componentRef.setInput('percentiles', true);
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();

		expect(component.chart_data.datasets.length).toBe(3);
		expect(component.chart_data.datasets.map((dataset) => dataset.label)).toEqual(['swap · p50', 'swap · p95', 'swap · p99']);
	});

	it('labels an unlabeled series from label_map when provided', () => {
		const metrics: SystemChartPoint[] = [{metric: 'cpu_percent', date: 3600, value: 42}];
		fixture.componentRef.setInput('type', 'line');
		fixture.componentRef.setInput('unit', 'percent');
		fixture.componentRef.setInput('label_map', {cpu_percent: 'CPU'});
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();

		expect(component.chart_data.datasets.map((dataset) => dataset.label)).toEqual(['CPU']);
	});

	it('adds a y-axis annotation when reference_line is set', () => {
		const metrics: SystemChartPoint[] = [{metric: 'load_avg_1m', date: 3600, value: 0.5}];
		fixture.componentRef.setInput('type', 'line');
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('reference_line', {value: 1, label: 'all cores busy'});
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();

		const annotation = (component.chart_options?.plugins as any)?.annotation?.annotations?.reference;
		expect(annotation).toBeDefined();
		expect(annotation.value).toBe(1);
		expect(annotation.label.content).toBe('all cores busy');
	});

	it('re-inits options when reference_line arrives after the first render', () => {
		const metrics: SystemChartPoint[] = [{metric: 'load_avg_1m', date: 3600, value: 0.5}];
		fixture.componentRef.setInput('type', 'line');
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();
		expect((component.chart_options?.plugins as any)?.annotation).toBeUndefined();

		fixture.componentRef.setInput('reference_line', {value: 1, label: 'all cores busy'});
		fixture.detectChanges();
		expect((component.chart_options?.plugins as any)?.annotation).toBeDefined();
	});

	it('extends the y axis above the ceiling when set', () => {
		const metrics: SystemChartPoint[] = [{metric: 'heap_used_mb', date: 3600, value: 120}];
		fixture.componentRef.setInput('type', 'line');
		fixture.componentRef.setInput('unit', 'megabytes');
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('ceiling', 4144);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();

		expect((component.chart_options?.scales?.['y'] as any)?.suggestedMax).toBeCloseTo(4144 * 1.02);
	});

	it('leaves options untouched when reference_line and ceiling are absent', () => {
		const metrics: SystemChartPoint[] = [{metric: 'cpu_percent', date: 3600, value: 42}];
		fixture.componentRef.setInput('type', 'line');
		fixture.componentRef.setInput('unit', 'percent');
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();

		expect((component.chart_options?.plugins as any)?.annotation).toBeUndefined();
		expect((component.chart_options?.scales?.['y'] as any)?.suggestedMax).toBeUndefined();
	});
});
