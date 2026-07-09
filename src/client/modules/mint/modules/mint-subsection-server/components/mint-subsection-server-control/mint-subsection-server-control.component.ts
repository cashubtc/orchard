/* Core Dependencies */
import {ChangeDetectionStrategy, Component, effect, input, output, untracked} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
/* Vendor Dependencies */
import {MatSelectChange} from '@angular/material/select';
import {DateRange} from '@angular/material/datepicker';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {NonNullableMintServerSettings} from '@client/modules/settings/types/setting.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Shared Dependencies */
import {MintMetricsInterval} from '@shared/generated.types';

type IntervalOption = {
	label: string;
	value: MintMetricsInterval;
};

@Component({
	selector: 'orc-mint-subsection-server-control',
	standalone: false,
	templateUrl: './mint-subsection-server-control.component.html',
	styleUrl: './mint-subsection-server-control.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionServerControlComponent {
	public page_settings = input.required<NonNullableMintServerSettings>();
	public loading = input.required<boolean>();
	public device_type = input.required<DeviceType>();

	public dateChange = output<number[]>();
	public presetChange = output<DateRangePreset>();
	public intervalChange = output<MintMetricsInterval>();

	public readonly panel = new FormGroup({
		daterange: new FormGroup({
			date_start: new FormControl<DateTime | null>(null, [Validators.required]),
			date_end: new FormControl<DateTime | null>(null, [Validators.required]),
		}),
		interval: new FormControl<MintMetricsInterval | null>(null, [Validators.required]),
	});

	public interval_options: IntervalOption[] = [
		{label: 'Minute', value: MintMetricsInterval.Minute},
		{label: 'Hour', value: MintMetricsInterval.Hour},
		{label: 'Day', value: MintMetricsInterval.Day},
	];

	public get height_state(): string {
		return this.panel?.invalid ? 'invalid' : 'valid';
	}

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

	/** Handles calendar date range selection — updates form controls and emits */
	public onDateRangeChange(range: DateRange<DateTime>): void {
		if (range.start) this.panel.controls.daterange.controls.date_start.setValue(range.start);
		if (range.end) this.panel.controls.daterange.controls.date_end.setValue(range.end);
		this.onDateChange();
	}

	public onDateChange(): void {
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
}
