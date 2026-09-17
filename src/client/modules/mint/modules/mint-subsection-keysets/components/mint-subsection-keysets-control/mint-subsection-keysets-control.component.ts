/* Core Dependencies */
import {ChangeDetectionStrategy, Component, effect, input, output, signal, untracked, viewChild} from '@angular/core';
import {FormControl, FormGroup, FormArray, Validators} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
/* Vendor Dependencies */
import {DateRange, MatCalendarCellClassFunction} from '@angular/material/datepicker';
import {MatMenuTrigger} from '@angular/material/menu';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {NonNullableMintKeysetsSettings} from '@client/modules/settings/types/setting.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';

type UnitOption = {
	label: string;
	value: string;
};
type StatusOption = {
	label: string;
	value: boolean;
};

@Component({
	selector: 'orc-mint-subsection-keysets-control',
	standalone: false,
	templateUrl: './mint-subsection-keysets-control.component.html',
	styleUrl: './mint-subsection-keysets-control.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionKeysetsControlComponent {
	/* Inputs */
	public readonly page_settings = input.required<NonNullableMintKeysetsSettings>();
	public readonly date_start = input<number>();
	public readonly date_end = input<number>();
	public readonly date_preset = input<DateRangePreset | null>(null);
	public readonly units = input<string[]>();
	public readonly status = input<boolean[]>();
	public readonly keysets = input.required<MintKeyset[]>();
	public readonly loading = input.required<boolean>();
	public readonly mint_genesis_time = input.required<number>();
	public readonly device_type = input.required<DeviceType>();

	/* Outputs */
	public readonly dateChange = output<number[]>();
	public readonly presetChange = output<DateRangePreset>();
	public readonly unitsChange = output<string[]>();
	public readonly statusChange = output<boolean[]>();

	private readonly filter_menu_trigger = viewChild(MatMenuTrigger);

	/* Form */
	public readonly panel = new FormGroup({
		daterange: new FormGroup({
			date_start: new FormControl<DateTime | null>(null, [Validators.required]),
			date_end: new FormControl<DateTime | null>(null, [Validators.required]),
		}),
		units: new FormArray<FormControl<boolean>>([]),
		status: new FormArray<FormControl<boolean>>([
			new FormControl(false, {nonNullable: true}),
			new FormControl(false, {nonNullable: true}),
		]),
	});

	/* State */
	public readonly filter_count = signal(0);
	public readonly unit_options = signal<UnitOption[]>([]);
	public readonly status_options: StatusOption[] = [
		{label: 'Active', value: true},
		{label: 'Inactive', value: false},
	];
	public get height_state(): string {
		return this.panel?.invalid ? 'invalid' : 'valid';
	}

	constructor() {
		this.panel
			.get('daterange')
			?.statusChanges.pipe(takeUntilDestroyed())
			.subscribe(() => {
				const group = this.panel.get('daterange');
				group?.markAllAsTouched();
			});

		/* Effect: Initialize form when loading completes */
		effect(() => {
			if (this.loading() !== false) return;
			untracked(() => this.initForm());
		});

		/* Effect: Sync date_start input to form */
		effect(() => {
			const date_start = this.date_start();
			if (!date_start) return;
			if (this.panel.controls.daterange.controls.date_start.value?.toSeconds() === date_start) return;
			this.panel.controls.daterange.controls.date_start.setValue(DateTime.fromSeconds(date_start));
		});

		/* Effect: Sync date_end input to form */
		effect(() => {
			const date_end = this.date_end();
			if (!date_end) return;
			if (this.panel.controls.daterange.controls.date_end.value?.toSeconds() === date_end) return;
			this.panel.controls.daterange.controls.date_end.setValue(DateTime.fromSeconds(date_end));
		});

		/* Effect: Sync units input to form */
		effect(() => {
			const units = this.units();
			if (!units) return;
			if (this.areUnitsEqual(this.getSelectedUnits(), units)) return;
			this.setUnitFilters(units);
			this.updateFilterCount();
		});

		/* Effect: Sync status input to form */
		effect(() => {
			const status = this.status();
			if (!status) return;
			if (this.areStatusEqual(this.getSelectedStatus(), status)) return;
			this.setStatusFilters(status);
			this.updateFilterCount();
		});
	}

	private initForm(): void {
		const settings = this.page_settings();
		const unique_units = Array.from(new Set(this.keysets().map((keyset) => keyset.unit)));
		this.unit_options.set(unique_units.map((unit) => ({label: unit.toUpperCase(), value: unit})));
		this.buildUnitFilters();
		this.panel.controls.daterange.controls.date_start.setValue(DateTime.fromSeconds(settings.date_start));
		this.panel.controls.daterange.controls.date_end.setValue(DateTime.fromSeconds(settings.date_end));
		this.setUnitFilters(settings.units);
		this.setStatusFilters(settings.status);
		this.updateFilterCount();
	}

	/** Builds the FormArray controls based on unit_options */
	private buildUnitFilters(): void {
		this.panel.controls.units.clear();
		this.unit_options().forEach(() => {
			this.panel.controls.units.push(new FormControl(false, {nonNullable: true}));
		});
	}

	/** Sets the FormArray values based on selected units */
	private setUnitFilters(selected_units: string[]): void {
		this.unit_options().forEach((option, index) => {
			const is_selected = selected_units.includes(option.value);
			this.panel.controls.units.at(index).setValue(is_selected);
		});
	}

	/** Gets the selected units from the FormArray */
	public getSelectedUnits(): string[] {
		const options = this.unit_options();
		if (!options.length) return [];
		return options.filter((_, index) => this.panel.controls.units.at(index).value).map((option) => option.value);
	}

	/** Compares two unit arrays for equality */
	private areUnitsEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		const sorted_a = [...a].sort();
		const sorted_b = [...b].sort();
		return sorted_a.every((unit, index) => unit === sorted_b[index]);
	}

	/** Sets the FormArray values based on selected status */
	private setStatusFilters(selected_status: boolean[]): void {
		this.status_options.forEach((option, index) => {
			const is_selected = selected_status.includes(option.value);
			this.panel.controls.status.at(index).setValue(is_selected);
		});
	}

	/** Gets the selected status from the FormArray */
	public getSelectedStatus(): boolean[] {
		return this.status_options.filter((_, index) => this.panel.controls.status.at(index).value).map((option) => option.value);
	}

	/** Compares two status arrays for equality */
	private areStatusEqual(a: boolean[], b: boolean[]): boolean {
		if (a.length !== b.length) return false;
		const sorted_a = [...a].sort();
		const sorted_b = [...b].sort();
		return sorted_a.every((status, index) => status === sorted_b[index]);
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

	public onStatusChange(): void {
		const selected_status = this.getSelectedStatus();
		const is_valid = this.isValidChange();
		if (!is_valid) return;
		this.updateFilterCount();
		this.statusChange.emit(selected_status);
	}

	public onClearFilter(): void {
		this.unitsChange.emit([]);
		this.statusChange.emit([]);
		this.filter_count.set(0);
		this.filter_menu_trigger()?.closeMenu();
	}

	private updateFilterCount(): void {
		let count = 0;
		if (this.getSelectedUnits().length > 0) count++;
		if (this.getSelectedStatus().length > 0) count++;
		this.filter_count.set(count);
	}

	public onCloseFilter(): void {
		this.filter_menu_trigger()?.closeMenu();
	}

	public genesis_class: MatCalendarCellClassFunction<DateTime> = (cellDate, view) => {
		if (view !== 'month') return '';
		const unix_seconds = cellDate.toSeconds();
		const unix_next_day = unix_seconds + 86400 - 1;
		const genesis_time = this.mint_genesis_time();
		if (unix_seconds <= genesis_time && unix_next_day >= genesis_time) return 'mint-genesis-date-class';
		return '';
	};

	private isValidChange(): boolean {
		const settings = this.page_settings();
		// validations
		if (this.panel.controls.daterange.controls.date_start.value === null) return false;
		if (this.panel.controls.daterange.controls.date_end.value === null) return false;
		// change checks
		if (this.panel.controls.daterange.controls.date_start.value.toSeconds() !== settings.date_start) return true;
		if (this.panel.controls.daterange.controls.date_end.value.toSeconds() !== settings.date_end) return true;
		if (!this.areUnitsEqual(this.getSelectedUnits(), settings.units)) return true;
		if (!this.areStatusEqual(this.getSelectedStatus(), settings.status)) return true;
		return false;
	}
}
