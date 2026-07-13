/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Application Dependencies */
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Native Dependencies */
import {OrcMintSubsectionSystemModule} from '@client/modules/mint/modules/mint-subsection-system/mint-subsection-system.module';
/* Local Dependencies */
import {MintSubsectionSystemChartComponent} from './mint-subsection-system-chart.component';
import {MintMetric} from '@client/modules/mint/classes/mint-metric.class';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

describe('MintSubsectionSystemChartComponent', () => {
	let component: MintSubsectionSystemChartComponent;
	let fixture: ComponentFixture<MintSubsectionSystemChartComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionSystemModule, MatIconTestingModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionSystemChartComponent);
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
		const metrics = [
			{
				metric: 'cdk_mint_operation_duration_seconds',
				labels: [{name: 'operation', value: 'swap'}],
				type: 'histogram',
				date: 3600,
				p50: 0.01,
				p95: 0.2,
				p99: 0.4,
			},
		] as unknown as MintMetric[];
		fixture.componentRef.setInput('type', 'line');
		fixture.componentRef.setInput('unit', 'seconds');
		fixture.componentRef.setInput('percentiles', true);
		fixture.componentRef.setInput('metrics', metrics);
		fixture.componentRef.setInput('loading', false);
		fixture.detectChanges();

		expect(component.chart_data.datasets.length).toBe(3);
		expect(component.chart_data.datasets.map((dataset) => dataset.label)).toEqual(['swap · p50', 'swap · p95', 'swap · p99']);
	});
});
