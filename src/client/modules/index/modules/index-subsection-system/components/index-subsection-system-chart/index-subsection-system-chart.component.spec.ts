/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Application Dependencies */
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Native Dependencies */
import {OrcIndexSubsectionSystemModule} from '@client/modules/index/modules/index-subsection-system/index-subsection-system.module';
import {SystemMetricSample} from '@client/modules/index/classes/system-metric.class';
/* Local Dependencies */
import {IndexSubsectionSystemChartComponent} from './index-subsection-system-chart.component';
/* Shared Dependencies */
import {SystemMetric, SystemMetricsInterval} from '@shared/generated.types';

describe('IndexSubsectionSystemChartComponent', () => {
	let component: IndexSubsectionSystemChartComponent;
	let fixture: ComponentFixture<IndexSubsectionSystemChartComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcIndexSubsectionSystemModule, MatIconTestingModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(IndexSubsectionSystemChartComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('locale', 'en-US');
		fixture.componentRef.setInput('metrics', []);
		fixture.componentRef.setInput('interval', SystemMetricsInterval.Hour);
		fixture.componentRef.setInput('unit', 'percent');
		fixture.componentRef.setInput('type', 'line');
		fixture.componentRef.setInput('loading', true);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('builds one dataset per distinct metric series', () => {
		const metrics = [
			{metric: SystemMetric.CpuPercent, date: 3600, value: 12},
			{metric: SystemMetric.CpuPercent, date: 7200, value: 18},
			{metric: SystemMetric.MemoryPercent, date: 3600, value: 40},
		] as unknown as SystemMetricSample[];
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();

		expect(component.chart_data.datasets.length).toBe(2);
		expect(component.chart_data.datasets.map((dataset) => dataset.label)).toEqual(['CPU', 'Memory']);
	});

	it('falls back to underscore-stripping for unmapped metric labels', () => {
		const metrics = [{metric: 'some_future_metric', date: 3600, value: 1}] as unknown as SystemMetricSample[];
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();

		expect(component.chart_data.datasets.map((dataset) => dataset.label)).toEqual(['some future metric']);
	});

	it('formats values with the configured unit suffix', () => {
		fixture.componentRef.setInput('unit', 'megabytes');
		fixture.detectChanges();
		expect(component.formatValue(128)).toBe('128 MB');
	});
});
