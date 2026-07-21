/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, effect, input, output, untracked, viewChild} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
/* Vendor Dependencies */
import {MatSelectChange} from '@angular/material/select';
import {MatMenuTrigger} from '@angular/material/menu';
import {DateRange} from '@angular/material/datepicker';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {NonNullableSystemMetricsSettings} from '@client/modules/settings/types/setting.types';
import {DateRangePreset, DateRangePresetOption, METRICS_DATE_RANGE_PRESET_OPTIONS} from '@client/modules/form/types/form-daterange.types';
import {getDateRangePresetLabel, isSubDayDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Native Dependencies */
import {SystemIntervalOption} from '@client/modules/system/types/system.types';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

@Component({
	selector: 'orc-system-control',
	standalone: false,
	templateUrl: './system-control.component.html',
	styleUrl: './system-control.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemControlComponent {
	public page_settings = input.required<NonNullableSystemMetricsSettings>();
	public loading = input.required<boolean>();
	public device_type = input.required<DeviceType>();

	public dateChange = output<number[]>();
	public presetChange = output<DateRangePreset>();
	public intervalChange = output<SystemMetricsInterval>();

	public readonly panel = new FormGroup({
		daterange: new FormGroup({
			date_start: new FormControl<DateTime | null>(null, [Validators.required]),
			date_end: new FormControl<DateTime | null>(null, [Validators.required]),
		}),
		interval: new FormControl<SystemMetricsInterval | null>(null, [Validators.required]),
	});

	public interval_options: SystemIntervalOption[] = [
		{label: 'Minute', value: SystemMetricsInterval.Minute},
		{label: 'Hour', value: SystemMetricsInterval.Hour},
		{label: 'Day', value: SystemMetricsInterval.Day},
	];

	public readonly preset_options: DateRangePresetOption[] = METRICS_DATE_RANGE_PRESET_OPTIONS;

	// True when the active preset is a rolling sub-day window — the trigger shows a label instead of a date range
	public readonly is_sub_day_window = computed(() => isSubDayDateRangePreset(this.page_settings().date_preset));
	public readonly sub_day_label = computed(() => getDateRangePresetLabel(this.page_settings().date_preset));

	public get height_state(): string {
		return this.panel?.invalid ? 'invalid' : 'valid';
	}

	private filter_menu_trigger = viewChild(MatMenuTrigger);
	private initialized = false;

	constructor() {
		// Initialize form when loading becomes false
		effect(() => {
			if (this.loading() !== false) return;
			if (this.initialized) return;
			this.initialized = true;
			untracked(() => this.initForm());
		});

		// Sync page settings into the form when they change
		effect(() => {
			const settings = this.page_settings();
			const date_start_control = this.panel.controls.daterange.controls.date_start;
			const date_end_control = this.panel.controls.daterange.controls.date_end;
			const interval_control = this.panel.controls.interval;
			if (date_start_control.value?.toSeconds() !== settings.date_start)
				date_start_control.setValue(DateTime.fromSeconds(settings.date_start));
			if (date_end_control.value?.toSeconds() !== settings.date_end)
				date_end_control.setValue(DateTime.fromSeconds(settings.date_end));
			if (interval_control.value !== settings.interval) interval_control.setValue(settings.interval);
		});
	}

	/* *******************************************************
		Form
	******************************************************** */

	private initForm(): void {
		const settings = this.page_settings();
		this.panel.controls.daterange.controls.date_start.setValue(DateTime.fromSeconds(settings.date_start));
		this.panel.controls.daterange.controls.date_end.setValue(DateTime.fromSeconds(settings.date_end));
		this.panel.controls.interval.setValue(settings.interval);
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Handles preset selection — emits the preset key for the parent to resolve */
	public onPresetChange(preset: DateRangePreset): void {
		this.presetChange.emit(preset);
	}

	/** Handles calendar date range selection — updates form controls and emits a day-granularity range */
	public onDateRangeChange(range: DateRange<DateTime>): void {
		if (range.start) this.panel.controls.daterange.controls.date_start.setValue(range.start);
		if (range.end) this.panel.controls.daterange.controls.date_end.setValue(range.end);
		this.emitDateChange();
	}

	/** Fires on manual input blur/enter and on picker close — skips sub-day windows, which are preset-driven */
	public onDateChange(): void {
		if (this.is_sub_day_window()) return;
		this.emitDateChange();
	}

	private emitDateChange(): void {
		if (this.panel.invalid) return;
		if (!this.isValidChange()) return;
		if (this.panel.controls.daterange.controls.date_start.value === null) return;
		if (this.panel.controls.daterange.controls.date_end.value === null) return;
		const date_start = Math.floor(this.panel.controls.daterange.controls.date_start.value.toSeconds());
		const date_end = Math.floor(this.panel.controls.daterange.controls.date_end.value.endOf('day').toSeconds());
		this.dateChange.emit([date_start, date_end]);
	}

	public onIntervalChange(event: MatSelectChange): void {
		if (this.panel.invalid) return;
		if (!this.isValidChange()) return;
		this.intervalChange.emit(event.value);
	}

	private isValidChange(): boolean {
		const settings = this.page_settings();
		// validations
		if (this.panel.controls.daterange.controls.date_start.value === null) return false;
		if (this.panel.controls.daterange.controls.date_end.value === null) return false;
		if (this.panel.controls.interval.value === null) return false;
		// change checks
		if (this.panel.controls.daterange.controls.date_start.value.toSeconds() !== settings.date_start) return true;
		if (this.panel.controls.daterange.controls.date_end.value.toSeconds() !== settings.date_end) return true;
		if (this.panel.controls.interval.value !== settings.interval) return true;
		return false;
	}

	/** Resets the panel to default filters — last 7 days and hourly interval — then closes the menu */
	public onClearFilter(): void {
		this.presetChange.emit(DateRangePreset.Last7Days);
		this.intervalChange.emit(SystemMetricsInterval.Hour);
		this.filter_menu_trigger()?.closeMenu();
	}

	/** Closes the filter menu without applying changes */
	public onCloseFilter(): void {
		this.filter_menu_trigger()?.closeMenu();
	}
}
