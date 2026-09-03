/* Core Dependencies */
import {ChangeDetectionStrategy, Component, effect, input, output, signal, viewChild} from '@angular/core';
import {FormGroup, FormControl, FormArray, Validators} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
import {DateRange, MatCalendarCellClassFunction} from '@angular/material/datepicker';
import {MatMenuTrigger} from '@angular/material/menu';
import {MatSelectChange} from '@angular/material/select';
/* Application Dependencies */
import {NonNullableMintDatabaseSettings} from '@client/modules/settings/types/setting.types';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {MintDataType} from '@client/modules/mint/enums/data-type.enum';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';

type TypeOption = {
	label: string;
	value: MintDataType;
	helper?: string;
};

@Component({
	selector: 'orc-mint-subsection-database-control',
	standalone: false,
	templateUrl: './mint-subsection-database-control.component.html',
	styleUrl: './mint-subsection-database-control.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDatabaseControlComponent {
	/* Inputs */
	public readonly page_settings = input.required<NonNullableMintDatabaseSettings>();
	public readonly filter = input<string>('');
	public readonly unit_options = input.required<{value: string; label: string}[]>();
	public readonly state_options = input.required<string[]>();
	public readonly state_enabled = input.required<boolean>();
	public readonly date_start = input<number>();
	public readonly date_end = input<number>();
	public readonly date_preset = input<DateRangePreset | null>(null);
	public readonly type = input<MintDataType>();
	public readonly states = input<string[]>();
	public readonly units = input<string[]>();
	public readonly loading = input.required<boolean>();
	public readonly mint_genesis_time = input.required<number>();
	public readonly keysets = input.required<MintKeyset[]>();
	public readonly device_type = input.required<DeviceType>();

	/* Outputs */
	public readonly dateChange = output<number[]>();
	public readonly presetChange = output<DateRangePreset>();
	public readonly typeChange = output<MintDataType>();
	public readonly unitsChange = output<string[]>();
	public readonly statesChange = output<string[]>();
	public readonly filterChange = output<Event>();

	private readonly filter_menu_trigger = viewChild(MatMenuTrigger);

	/* Form */
	public readonly panel = new FormGroup({
		type: new FormControl<MintDataType | null>(null, [Validators.required]),
		daterange: new FormGroup({
			date_start: new FormControl<DateTime | null>(null, [Validators.required]),
			date_end: new FormControl<DateTime | null>(null, [Validators.required]),
		}),
		units: new FormArray<FormControl<boolean>>([]),
		states: new FormArray<FormControl<boolean>>([]),
		filter: new FormControl<string>(''),
	});

	/* State */
	public readonly type_options = signal<TypeOption[]>([]);
	public readonly filter_count = signal(0);

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
			this.initForm();
		});

		/* Effect: Sync state_enabled input to form */
		effect(() => {
			const enabled = this.state_enabled();
			if (enabled) {
				this.panel.controls.states.enable();
			} else {
				this.panel.controls.states.disable();
			}
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

		/* Effect: Sync type input to form */
		effect(() => {
			const type = this.type();
			if (!type) return;
			if (this.panel.controls.type.value === type) return;
			this.panel.controls.type.setValue(type);
		});

		/* Effect: Sync units input to form */
		effect(() => {
			const units = this.units();
			if (!units) return;
			if (this.areUnitsEqual(this.getSelectedUnits(), units)) return;
			this.setUnitFilters(units);
			this.updateFilterCount();
		});

		/* Effect: Sync states input to form */
		effect(() => {
			const states = this.states();
			if (!states) return;
			if (this.areStatesEqual(this.getSelectedStates(), states)) return;
			this.setStateFilters(states);
			this.updateFilterCount();
		});
	}

	private initForm(): void {
		const settings = this.page_settings();
		this.type_options.set(this.getTypeOptions());
		this.buildUnitFilters();
		this.buildStateFilters();
		this.panel.controls.type.setValue(settings.type);
		this.panel.controls.daterange.controls.date_start.setValue(DateTime.fromSeconds(settings.date_start));
		this.panel.controls.daterange.controls.date_end.setValue(DateTime.fromSeconds(settings.date_end));
		this.setUnitFilters(settings.units);
		this.setStateFilters(settings.states);
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

	/** Builds the FormArray controls based on state_options */
	private buildStateFilters(): void {
		this.panel.controls.states.clear();
		this.state_options().forEach(() => {
			this.panel.controls.states.push(new FormControl(false, {nonNullable: true}));
		});
	}

	/** Sets the FormArray values based on selected states */
	private setStateFilters(selected_states: string[]): void {
		this.state_options().forEach((option, index) => {
			const is_selected = selected_states.includes(option);
			this.panel.controls.states.at(index).setValue(is_selected);
		});
	}

	/** Gets the selected states from the FormArray */
	public getSelectedStates(): string[] {
		const options = this.state_options();
		if (!options.length) return [];
		return options.filter((_, index) => this.panel.controls.states.at(index).value);
	}

	/** Compares two state arrays for equality */
	private areStatesEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		const sorted_a = [...a].sort();
		const sorted_b = [...b].sort();
		return sorted_a.every((state, index) => state === sorted_b[index]);
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

	public onTypeChange(event: MatSelectChange): void {
		if (this.panel.invalid) return;
		const is_valid = this.isValidChange();
		if (!is_valid) return;
		this.typeChange.emit(event.value);
	}

	public onUnitsChange(): void {
		const selected_units = this.getSelectedUnits();
		const is_valid = this.isValidChange();
		if (!is_valid) return;
		this.updateFilterCount();
		this.unitsChange.emit(selected_units);
	}

	public onStatesChange(): void {
		const selected_states = this.getSelectedStates();
		const is_valid = this.isValidChange();
		if (!is_valid) return;
		this.updateFilterCount();
		this.statesChange.emit(selected_states);
	}

	public onClearFilter(): void {
		this.unitsChange.emit([]);
		this.statesChange.emit([]);
		this.filter_count.set(0);
		this.filter_menu_trigger()?.closeMenu();
	}

	private updateFilterCount(): void {
		let count = 0;
		if (this.getSelectedUnits().length > 0) count++;
		if (this.getSelectedStates().length > 0) count++;
		this.filter_count.set(count);
	}

	public onCloseFilter(): void {
		this.filter_menu_trigger()?.closeMenu();
	}

	public genesis_class: MatCalendarCellClassFunction<DateTime> = (cellDate, view) => {
		if (view !== 'month') return '';
		const genesis_time = this.mint_genesis_time();
		const unix_seconds = cellDate.toSeconds();
		const unix_next_day = unix_seconds + 86400 - 1;
		if (unix_seconds <= genesis_time && unix_next_day >= genesis_time) return 'mint-genesis-date-class';
		return '';
	};

	public getSelectedTypeLabel(value: any): string {
		const selected_type = this.type_options().find((type) => type.value === value);
		return selected_type ? selected_type.label : '';
	}

	private getTypeOptions(): TypeOption[] {
		return Object.values(MintDataType).map((type) => ({
			label: this.getTypeLabel(type),
			helper: this.getTypeHelper(type),
			value: type,
		}));
	}
	private getTypeLabel(type: MintDataType): string {
		if (type === MintDataType.MintMints) return 'Mints';
		if (type === MintDataType.MintMelts) return 'Melts';
		if (type === MintDataType.MintSwaps) return 'Swaps';
		return 'Unknown';
	}
	private getTypeHelper(type: MintDataType): string {
		if (type === MintDataType.MintMints) return 'Mint deposits';
		if (type === MintDataType.MintMelts) return 'Mint withdrawals';
		if (type === MintDataType.MintSwaps) return 'Mint internal swaps';
		return 'n/a';
	}

	private isValidChange(): boolean {
		const settings = this.page_settings();
		// validations
		if (this.panel.controls.type.value === null) return false;
		if (this.panel.controls.daterange.controls.date_start.value === null) return false;
		if (this.panel.controls.daterange.controls.date_end.value === null) return false;
		// change checks
		if (this.panel.controls.type.value !== settings.type) return true;
		if (this.panel.controls.daterange.controls.date_start.value.toSeconds() !== settings.date_start) return true;
		if (this.panel.controls.daterange.controls.date_end.value.toSeconds() !== settings.date_end) return true;
		if (!this.areUnitsEqual(this.getSelectedUnits(), settings.units)) return true;
		if (!this.areStatesEqual(this.getSelectedStates(), settings.states)) return true;
		return false;
	}
}
