/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcChartModule} from '@client/modules/chart/chart.module';
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Local Dependencies */
import {ChartPieComponent} from './chart-pie.component';

describe('ChartPieComponent', () => {
	let component: ChartPieComponent;
	let fixture: ComponentFixture<ChartPieComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcChartModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(ChartPieComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('slices', []);
		fixture.detectChanges();
	});

	it('should create and render the doughnut', () => {
		expect(component).toBeTruthy();
	});

	it('builds one data point per slice with labels and colours', () => {
		fixture.componentRef.setInput('slices', [
			{label: '/mint', value: 5},
			{label: '/melt', value: 3},
		]);
		const data = component.chart_data();
		expect(data.labels).toEqual(['/mint', '/melt']);
		expect(data.datasets[0].data).toEqual([5, 3]);
		expect((data.datasets[0].backgroundColor as string[]).length).toBe(2);
	});
});
