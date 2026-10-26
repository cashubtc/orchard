/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
/* Application Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
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
		fixture.componentRef.setInput('lightning_balance', null);
		fixture.componentRef.setInput('lightning_enabled', false);
		fixture.componentRef.setInput('lightning_errors', []);
		fixture.componentRef.setInput('lightning_loading', false);
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
	it('adds the Federation menu item after a cold member mode probe resolves', () => {
		const federation = TestBed.inject(FederationService);
		federation.mode.set(null);
		expect(component.items().some((item) => item.name === 'Federation')).toBeFalse();
		federation.mode.set('member');
		expect(component.items().some((item) => item.name === 'Federation')).toBeTrue();
	});
});
