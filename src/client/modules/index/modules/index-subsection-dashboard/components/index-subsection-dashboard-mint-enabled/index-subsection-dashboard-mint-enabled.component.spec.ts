/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Native Dependencies */
import {OrcIndexSubsectionDashboardModule} from '@client/modules/index/modules/index-subsection-dashboard/index-subsection-dashboard.module';
/* Local Dependencies */
import {IndexSubsectionDashboardMintEnabledComponent} from './index-subsection-dashboard-mint-enabled.component';

describe('IndexSubsectionDashboardMintEnabledComponent', () => {
	let component: IndexSubsectionDashboardMintEnabledComponent;
	let fixture: ComponentFixture<IndexSubsectionDashboardMintEnabledComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcIndexSubsectionDashboardModule],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(IndexSubsectionDashboardMintEnabledComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('loading', false);
		fixture.componentRef.setInput('loading_icon', false);
		fixture.componentRef.setInput('info', null);
		fixture.componentRef.setInput('keysets', []);
		fixture.componentRef.setInput('balances', []);
		fixture.componentRef.setInput('icon_data', null);
		fixture.componentRef.setInput('reserves', null);
		fixture.componentRef.setInput('reserves_errors', []);
		fixture.componentRef.setInput('reserves_loading', false);
		fixture.componentRef.setInput('bitcoin_oracle_enabled', false);
		fixture.componentRef.setInput('bitcoin_oracle_price', null);
		fixture.componentRef.setInput('mint_errors', []);
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.componentRef.setInput('activity_summary', null);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
