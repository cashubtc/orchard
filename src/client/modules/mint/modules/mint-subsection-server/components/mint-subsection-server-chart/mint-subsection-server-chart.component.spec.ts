/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcMintSubsectionServerModule} from '@client/modules/mint/modules/mint-subsection-server/mint-subsection-server.module';
/* Local Dependencies */
import {MintSubsectionServerChartComponent} from './mint-subsection-server-chart.component';
import {MintMetric} from '@client/modules/mint/classes/mint-metric.class';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

describe('MintSubsectionServerChartComponent', () => {
	let component: MintSubsectionServerChartComponent;
	let fixture: ComponentFixture<MintSubsectionServerChartComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionServerModule, MatIconTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionServerChartComponent);
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
