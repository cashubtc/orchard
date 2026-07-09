/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcChartModule} from '@client/modules/chart/chart.module';
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Local Dependencies */
import {ChartGaugeComponent} from './chart-gauge.component';

describe('ChartGaugeComponent', () => {
	let component: ChartGaugeComponent;
	let fixture: ComponentFixture<ChartGaugeComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcChartModule],
			providers: [provideChartConfig()],
		}).compileComponents();

		fixture = TestBed.createComponent(ChartGaugeComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('value', 0);
		fixture.detectChanges();
	});

	it('should create and render the doughnut', () => {
		expect(component).toBeTruthy();
	});

	it('colours the arc by threshold', () => {
		fixture.componentRef.setInput('warn', 1);
		fixture.componentRef.setInput('danger', 5);
		fixture.componentRef.setInput('value', 0.5);
		expect(component.color()).toBe('#14E0B0');
		fixture.componentRef.setInput('value', 2);
		expect(component.color()).toBe('#FFB020');
		fixture.componentRef.setInput('value', 9);
		expect(component.color()).toBe('#FF5470');
	});

	it('formats the centre value with the unit and a dash for null', () => {
		fixture.componentRef.setInput('value', null);
		expect(component.display_value()).toBe('—');
		fixture.componentRef.setInput('value', 2.5);
		expect(component.display_value()).toBe('2.5%');
	});
});
