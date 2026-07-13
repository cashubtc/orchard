/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
/* Native Dependencies */
import {OrcIndexSubsectionSystemModule} from '@client/modules/index/modules/index-subsection-system/index-subsection-system.module';
/* Application Dependencies */
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
/* Local Dependencies */
import {IndexSubsectionSystemControlComponent} from './index-subsection-system-control.component';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

describe('IndexSubsectionSystemControlComponent', () => {
	let component: IndexSubsectionSystemControlComponent;
	let fixture: ComponentFixture<IndexSubsectionSystemControlComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcIndexSubsectionSystemModule, MatIconTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(IndexSubsectionSystemControlComponent);
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
