/* Core Dependencies */
import {ChangeDetectionStrategy, Component, viewChild, signal, input, output, effect, untracked} from '@angular/core';
import {FormArray, FormControl, FormGroup, Validators} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
/* Vendor Dependencies */
import {MatSelectChange} from '@angular/material/select';
import {DateRange, MatCalendarCellClassFunction} from '@angular/material/datepicker';
import {DateTime} from 'luxon';
import {MatMenuTrigger} from '@angular/material/menu';
/* Application Dependencies */
import {NonNullableMintDashboardSettings} from '@client/modules/settings/types/setting.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
/* Shared Dependencies */
import {AnalyticsInterval} from '@shared/generated.types';

type UnitOption = {
	label: string;
	value: string;
};
type IntervalOption = {
	label: string;
	value: AnalyticsInterval;
};

@Component({
	selector: 'orc-mint-subsection-dashboard-control',
	standalone: false,
	templateUrl: './mint-subsection-dashboard-control.component.html',
	styleUrl: './mint-subsection-dashboard-control.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDashboardControlComponent {
	public page_settings = input.required<NonNullableMintDashboardSettings>();
	public date_start = input<number>();
	public date_end = input<number>();
	public date_preset = input<DateRangePreset | null>(null);
	public units = input<string[]>();
	public interval = input<AnalyticsInterval>();
	public keysets = input.required<MintKeyset[]>();
	public loading = input.required<boolean>();
	public mint_genesis_time = input.required<number>();
	public device_type = input.required<DeviceType>();
	public bitcoin_oracle_enabled = input.required<boolean>();

	public dateChange = output<number[]>();
	public presetChange = output<DateRangePreset>();
	public unitsChange = output<string[]>();
	public intervalChange = output<AnalyticsInterval>();
	public oracleUsedChange = output<boolean>();

	public filter_count = signal(0);

	public readonly panel = new FormGroup({
		daterange: new FormGroup({
			date_start: new FormControl<DateTime | null>(null, [Validators.required]),
			date_end: new FormControl<DateTime | null>(null, [Validators.required]),
		}),
		units: new FormArray<FormControl<boolean>>([]),
		interval: new FormControl<AnalyticsInterval | null>(null, [Validators.required]),
		oracle_used: new FormControl<boolean | null>(null, [Validators.required]),
	});

	public unit_options!: UnitOption[];
	public interval_options: IntervalOption[] = [
		{label: 'Hour', value: AnalyticsInterval.Hour},
		{label: 'Day', value: AnalyticsInterval.Day},
		{label: 'Week', value: AnalyticsInterval.Week},
		{label: 'Month', value: AnalyticsInterval.Month},
	];
	public genesis_class: MatCalendarCellClassFunction<DateTime> = (cellDate, view) => {
		if (view !== 'month') return '';
		const unix_seconds = cellDate.toSeconds();
		const unix_next_day = unix_seconds + 86400 - 1;
		const genesis_time = this.mint_genesis_time();
		if (unix_seconds <= genesis_time && unix_next_day >= genesis_time) return 'mint-genesis-date-class';
		return '';
	};

	public get height_state(): string {
		return this.panel?.invalid ? 'invalid' : 'valid';
	}

	private filter_menu_trigger = viewChild(MatMenuTrigger);
	private initialized = false;

	constructor() {
		this.panel
			.get('daterange')
			?.statusChanges.pipe(takeUntilDestroyed())
			.subscribe(() => {
				const group = this.panel.get('daterange');
				group?.markAllAsTouched();
			});

		// Initialize form when loading becomes false
		effect(() => {
			if (this.loading() !== false) return;
			if (this.initialized) return;
			this.initialized = true;
			untracked(() => this.initForm());
		});

		// Sync date_start input to form
		effect(() => {
			const date_start = this.date_start();
			if (!date_start) return;
			if (this.panel.controls.daterange.get('date_start')?.value?.toSeconds() === date_start) return;
			this.panel.controls.daterange.get('date_start')?.setValue(DateTime.fromSeconds(date_start));
		});

		// Sync date_end input to form
		effect(() => {
			const date_end = this.date_end();
			if (!date_end) return;
			if (this.panel.controls.daterange.get('date_end')?.value?.toSeconds() === date_end) return;
			this.panel.controls.daterange.get('date_end')?.setValue(DateTime.fromSeconds(date_end));
		});

		// Sync units input to form
		effect(() => {
			const units = this.units();
			if (!units) return;
			if (!this.initialized) return;
			if (this.areUnitsEqual(this.getSelectedUnits(), units)) return;
			this.setUnitFilters(units);
			this.updateFilterCount();
		});

		// Sync interval input to form
		effect(() => {
			const interval = this.interval();
			if (!interval) return;
			if (this.panel.controls.interval.value === interval) return;
			this.panel.controls.interval.setValue(interval);
		});
	}

	private initForm(): void {
		const settings = this.page_settings();
		const unique_units = Array.from(new Set(this.keysets().map((keyset) => keyset.unit)));
		this.unit_options = unique_units.map((unit) => ({label: unit.toUpperCase(), value: unit}));
		this.buildUnitFilters();
		this.panel.controls.daterange.controls.date_start.setValue(DateTime.fromSeconds(settings.date_start));
		this.panel.controls.daterange.controls.date_end.setValue(DateTime.fromSeconds(settings.date_end));
		this.setUnitFilters(settings.units);
		this.panel.controls.interval.setValue(settings.interval);
		this.panel.controls.oracle_used.setValue(settings.oracle_used);
		this.updateFilterCount();
	}

	/** Builds the FormArray controls based on unit_options */
	private buildUnitFilters(): void {
		this.panel.controls.units.clear();
		this.unit_options.forEach(() => {
			this.panel.controls.units.push(new FormControl(false, {nonNullable: true}));
		});
	}

	/** Sets the FormArray values based on selected units */
	private setUnitFilters(selected_units: string[]): void {
		this.unit_options.forEach((option, index) => {
			const is_selected = selected_units.includes(option.value);
			this.panel.controls.units.at(index).setValue(is_selected);
		});
	}

	/** Gets the selected units from the FormArray */
	public getSelectedUnits(): string[] {
		if (!this.unit_options) return [];
		return this.unit_options.filter((_, index) => this.panel.controls.units.at(index).value).map((option) => option.value);
	}

	/** Compares two unit arrays for equality */
	private areUnitsEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		const sorted_a = [...a].sort();
		const sorted_b = [...b].sort();
		return sorted_a.every((unit, index) => unit === sorted_b[index]);
	}

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
		const is_valid = this.isValidChange();
		if (!is_valid) return;
		if (this.panel.controls.daterange.controls.date_start.value === null) return;
		if (this.panel.controls.daterange.controls.date_end.value === null) return;
		const date_start = Math.floor(this.panel.controls.daterange.controls.date_start.value.toSeconds());
		const date_end = Math.floor(this.panel.controls.daterange.controls.date_end.value.endOf('day').toSeconds());
		this.dateChange.emit([date_start, date_end]);
	}

	public onUnitsChange(): void {
		const selected_units = this.getSelectedUnits();
		const is_valid = this.isValidChange();
		if (!is_valid) return;
		this.updateFilterCount();
		this.unitsChange.emit(selected_units);
	}

	public onIntervalChange(event: MatSelectChange): void {
		if (this.panel.invalid) return;
		const is_valid = this.isValidChange();
		if (!is_valid) return;
		this.intervalChange.emit(event.value);
	}

	public onOracleUsedChange(): void {
		const is_valid = this.isValidChange();
		if (!is_valid) return;
		this.updateFilterCount();
		const oracle_used = this.panel.controls.oracle_used.value ?? false;
		this.oracleUsedChange.emit(oracle_used);
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
		if (!this.areUnitsEqual(this.getSelectedUnits(), settings.units)) return true;
		if (this.panel.controls.interval.value !== settings.interval) return true;
		if (this.panel.controls.oracle_used.value !== settings.oracle_used) return true;
		return false;
	}

	private updateFilterCount(): void {
		let count = 0;
		if (this.getSelectedUnits().length > 0) count++;
		if (this.panel.controls.oracle_used.value) count++;
		this.filter_count.set(count);
	}

	public onClearFilter(): void {
		this.unitsChange.emit([]);
		this.filter_count.set(0);
		this.filter_menu_trigger()?.closeMenu();
	}

	public onCloseFilter(): void {
		this.filter_menu_trigger()?.closeMenu();
	}
}
