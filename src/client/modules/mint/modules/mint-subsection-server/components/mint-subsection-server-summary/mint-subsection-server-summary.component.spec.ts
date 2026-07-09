/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcMintSubsectionServerModule} from '@client/modules/mint/modules/mint-subsection-server/mint-subsection-server.module';
import {MintMetricSnapshot} from '@client/modules/mint/classes/mint-metric.class';
/* Local Dependencies */
import {MintSubsectionServerSummaryComponent} from './mint-subsection-server-summary.component';
/* Shared Dependencies */
import {MintMetricType} from '@shared/generated.types';

const snapshot = (metric: string, value: number, type: MintMetricType = MintMetricType.Gauge): MintMetricSnapshot =>
	new MintMetricSnapshot({metric, labels: [], type, value, sum: null, count: null});

describe('MintSubsectionServerSummaryComponent', () => {
	let component: MintSubsectionServerSummaryComponent;
	let fixture: ComponentFixture<MintSubsectionServerSummaryComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionServerModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionServerSummaryComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('snapshots', []);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should compute summary values from snapshots', () => {
		fixture.componentRef.setInput('snapshots', [
			snapshot('process_cpu_usage_percent', 12.5),
			snapshot('cdk_auth_attempts_total', 10, MintMetricType.Counter),
			snapshot('cdk_auth_successes_total', 9, MintMetricType.Counter),
		]);
		fixture.detectChanges();
		expect(component.cpu_percent()).toBe(12.5);
		expect(component.auth_success_percent()).toBe(90);
	});

	it('should sum in-flight requests across label sets', () => {
		fixture.componentRef.setInput('snapshots', [
			snapshot('cdk_mint_in_flight_requests', 1),
			snapshot('cdk_mint_in_flight_requests', 2),
		]);
		fixture.detectChanges();
		expect(component.in_flight_requests()).toBe(3);
	});

	it('should return null auth ratio when there are no attempts', () => {
		fixture.componentRef.setInput('snapshots', [snapshot('cdk_auth_attempts_total', 0, MintMetricType.Counter)]);
		fixture.detectChanges();
		expect(component.auth_success_percent()).toBeNull();
	});
});
