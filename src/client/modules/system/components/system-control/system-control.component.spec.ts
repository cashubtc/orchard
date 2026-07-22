/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {DateTime} from 'luxon';
/* Native Dependencies */
import {OrcSystemModule} from '@client/modules/system/system.module';
/* Application Dependencies */
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
/* Local Dependencies */
import {SystemControlComponent} from './system-control.component';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

describe('SystemControlComponent', () => {
	let component: SystemControlComponent;
	let fixture: ComponentFixture<SystemControlComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcSystemModule, MatIconTestingModule],
		}).compileComponents();

		fixture = TestBed.createComponent(SystemControlComponent);
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

	it('should reset to the last-7-days preset on clear and leave the interval to the parent', () => {
		const preset_spy = spyOn(component.presetChange, 'emit');
		const interval_spy = spyOn(component.intervalChange, 'emit');
		component.onClearFilter();
		expect(preset_spy).toHaveBeenCalledWith(DateRangePreset.Last7Days);
		expect(interval_spy).not.toHaveBeenCalled();
	});

	it('should emit a day-snapped range on a manual date change when no sub-day window is active', () => {
		const spy = spyOn(component.dateChange, 'emit');
		const start = DateTime.fromSeconds(1_000_000);
		const end = DateTime.fromSeconds(2_000_000);
		component.panel.controls.daterange.controls.date_start.setValue(start);
		component.panel.controls.daterange.controls.date_end.setValue(end);
		component.onDateChange();
		expect(spy).toHaveBeenCalledWith([Math.floor(start.toSeconds()), Math.floor(end.endOf('day').toSeconds())]);
	});

	describe('sub-day window', () => {
		const applySubDayPreset = () => {
			fixture.componentRef.setInput('page_settings', {
				date_start: 0,
				date_end: 900,
				date_preset: DateRangePreset.Last15Minutes,
				interval: SystemMetricsInterval.Minute,
			});
			fixture.detectChanges();
		};

		it('flags a sub-day window and exposes its label when a sub-day preset is active', () => {
			applySubDayPreset();
			expect(component.is_sub_day_window()).toBe(true);
			expect(component.sub_day_label()).toBe('Last 15 minutes');
		});

		it('treats day-granularity presets as a regular date range', () => {
			fixture.componentRef.setInput('page_settings', {
				date_start: 0,
				date_end: 86400,
				date_preset: DateRangePreset.Last7Days,
				interval: SystemMetricsInterval.Hour,
			});
			fixture.detectChanges();
			expect(component.is_sub_day_window()).toBe(false);
		});

		it('does not day-snap or emit a date change while a sub-day window is active', () => {
			applySubDayPreset();
			const spy = spyOn(component.dateChange, 'emit');
			component.onDateChange();
			expect(spy).not.toHaveBeenCalled();
		});
	});
});
