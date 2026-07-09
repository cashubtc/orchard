/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcMintSubsectionServerModule} from '@client/modules/mint/modules/mint-subsection-server/mint-subsection-server.module';
/* Local Dependencies */
import {MintSubsectionServerChartComponent} from './mint-subsection-server-chart.component';
/* Shared Dependencies */
import {MintMetricsInterval} from '@shared/generated.types';

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
		fixture.componentRef.setInput('interval', MintMetricsInterval.Hour);
		fixture.componentRef.setInput('unit', 'count');
		fixture.componentRef.setInput('type', 'bar');
		fixture.componentRef.setInput('loading', true);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
