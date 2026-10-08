/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, output, signal, viewChild} from '@angular/core';
import {FormGroup, ValidationErrors} from '@angular/forms';
/* Application Dependencies */
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';
/* Shared Dependencies */
import {OrchardNut4Method, OrchardNut5Method} from '@shared/generated.types';

@Component({
	selector: 'orc-mint-subsection-config-form-max',
	standalone: false,
	templateUrl: './mint-subsection-config-form-max.component.html',
	styleUrl: './mint-subsection-config-form-max.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionConfigFormMaxComponent {
	public form_group = input.required<FormGroup>(); // form group containing the max amount control
	public control_name = input.required<keyof OrchardNut4Method | keyof OrchardNut5Method>(); // name of the form control to bind
	public control_dirty = input.required<boolean | undefined>(); // whether the control is dirty
	public control_invalid = input.required<boolean | undefined>(); // whether the control is invalid
	public control_errors = input.required<ValidationErrors | null | undefined>(); // errors for the control
	public unit = input.required<string>(); // unit to display (e.g. 'sat')
	public nut = input.required<'nut4' | 'nut5'>(); // which nut configuration this controls
	public stat_amounts = input.required<Record<string, number>[]>(); // amounts for the stats

	public update = output<keyof OrchardNut4Method | keyof OrchardNut5Method>(); // emitted when form is submitted
	public cancel = output<keyof OrchardNut4Method | keyof OrchardNut5Method>(); // emitted when form is cancelled
	public hot = output<boolean>(); // emitted when form hot state changes

	public element_max = viewChild.required<ElementRef<HTMLInputElement>>('element_max'); // reference to the input element

	public focused_max = signal<boolean>(false); // tracks if the input is focused
	public control_touched = signal<boolean>(false); // tracks if the control has been touched
	public help_status = signal<boolean>(false); // tracks if the help is visible

	public form_hot = computed(() => {
		if (this.focused_max()) return true;
		return this.control_dirty();
	});

	public decimals = computed(() => getUnitMeta(this.unit()).decimals); // fraction digits the unit is entered with

	public help_text = computed(() => {
		if (this.nut() === 'nut4') return 'Configure the maximum amount of ecash that can be minted per deposit invoice.';
		if (this.nut() === 'nut5') return 'Configure the maximum amount of ecash that can be melted per withdrawal invoice.';
		return '';
	});

	constructor() {
		effect(() => {
			this.hot.emit(this.form_hot() ?? false);
		});
	}

	public onFocus(): void {
		this.focused_max.set(true);
	}

	public onBlur(): void {
		this.focused_max.set(false);
		this.control_touched.set(true);
	}

	public onSubmit(event: Event): void {
		event.preventDefault();
		this.update.emit(this.control_name());
		this.element_max().nativeElement.blur();
		this.form_group().get(this.control_name())?.markAsPristine();
		this.control_touched.set(false);
		this.focused_max.set(false);
	}

	public onCancel(event: Event): void {
		event.preventDefault();
		this.cancel.emit(this.control_name());
		this.element_max().nativeElement.blur();
		this.form_group().get(this.control_name())?.markAsPristine();
		this.control_touched.set(false);
		this.focused_max.set(false);
	}
}
