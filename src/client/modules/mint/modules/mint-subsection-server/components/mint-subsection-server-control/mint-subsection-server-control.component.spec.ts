/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcMintSubsectionServerModule} from '@client/modules/mint/modules/mint-subsection-server/mint-subsection-server.module';
/* Local Dependencies */
import {MintSubsectionServerControlComponent} from './mint-subsection-server-control.component';
/* Shared Dependencies */
import {MintMetricsInterval} from '@shared/generated.types';

describe('MintSubsectionServerControlComponent', () => {
	let component: MintSubsectionServerControlComponent;
	let fixture: ComponentFixture<MintSubsectionServerControlComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionServerModule, MatIconTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionServerControlComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('page_settings', {
			date_start: 0,
			date_end: 86400,
			date_preset: null,
			interval: MintMetricsInterval.Hour,
		});
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
