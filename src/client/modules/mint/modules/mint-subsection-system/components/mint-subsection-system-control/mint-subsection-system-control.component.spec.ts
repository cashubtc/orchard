/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcMintSubsectionSystemModule} from '@client/modules/mint/modules/mint-subsection-system/mint-subsection-system.module';
/* Application Dependencies */
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
/* Local Dependencies */
import {MintSubsectionSystemControlComponent} from './mint-subsection-system-control.component';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

describe('MintSubsectionSystemControlComponent', () => {
	let component: MintSubsectionSystemControlComponent;
	let fixture: ComponentFixture<MintSubsectionSystemControlComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcMintSubsectionSystemModule, MatIconTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(MintSubsectionSystemControlComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('page_settings', {
			date_start: 0,
			date_end: 86400,
			date_preset: null,
			interval: SystemMetricsInterval.Hour,
		});
		fixture.componentRef.setInput('loading', true);
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should reset to the last-7-days preset and hourly interval on clear', () => {
		const preset_spy = spyOn(component.presetChange, 'emit');
		const interval_spy = spyOn(component.intervalChange, 'emit');
		component.onClearFilter();
		expect(preset_spy).toHaveBeenCalledWith(DateRangePreset.Last7Days);
		expect(interval_spy).toHaveBeenCalledWith(SystemMetricsInterval.Hour);
	});
});
