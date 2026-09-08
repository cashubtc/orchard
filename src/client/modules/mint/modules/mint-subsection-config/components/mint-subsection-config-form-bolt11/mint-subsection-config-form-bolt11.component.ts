/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output, signal, SimpleChanges, OnChanges} from '@angular/core';
import {FormGroup} from '@angular/forms';
import {MatSlideToggleChange} from '@angular/material/slide-toggle';
/* Application Dependencies */
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
/* Shared Dependencies */
import {OrchardNut4Method, OrchardNut5Method} from '@shared/generated.types';

/** Bolt11 limits and stats, adding the description (mint) / amountless (melt) toggle */
@Component({
	selector: 'orc-mint-subsection-config-form-bolt11',
	standalone: false,
	templateUrl: './mint-subsection-config-form-bolt11.component.html',
	styleUrl: './mint-subsection-config-form-bolt11.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionConfigFormBolt11Component implements OnChanges {
	public nut = input.required<'nut4' | 'nut5'>(); // which nut configuration this controls
	public unit = input.required<string>(); // unit to display (e.g. 'sat')
	public method = input.required<string>(); // payment method (e.g. 'bolt11')
	public form_group = input.required<FormGroup>(); // form group containing the method controls
	public form_status = input<boolean>(false); // whether the form is in a specific status
	public locale = input.required<string>(); // locale for number formatting
	public loading = input.required<boolean>(); // whether data is loading
	public quotes = input.required<MintMintQuote[] | MintMeltQuote[]>(); // quotes to display in chart

	public update = output<{
		nut: 'nut4' | 'nut5';
		unit: string;
		method: string;
		control_name: keyof OrchardNut4Method | keyof OrchardNut5Method;
		form_group: FormGroup;
	}>(); // emitted when a control is submitted
	public cancel = output<{
		nut: 'nut4' | 'nut5';
		unit: string;
		method: string;
		control_name: keyof OrchardNut4Method | keyof OrchardNut5Method;
		form_group: FormGroup;
	}>(); // emitted when a control is cancelled

	public help_status = signal<boolean>(false); // tracks if the help is visible

	public form_bolt11 = computed<FormGroup>(() => {
		return this.form_group().get(this.unit())?.get(this.method()) as FormGroup;
	});

	public toggle_control = computed((): keyof OrchardNut4Method | keyof OrchardNut5Method => {
		return this.nut() === 'nut4' ? 'description' : 'amountless';
	});

	public toggle_control_name = computed(() => {
		return this.nut() === 'nut4' ? 'Description' : 'Amountless';
	});

	public toggle_help_text = computed(() => {
		if (this.nut() === 'nut4') {
			return 'Allow users to add a description to bolt11 minting invoices.';
		}
		return 'Indicates whether the bolt11 payment method backend supports paying amountless invoices.<br>Not configurable. On/Off determined by lightning backend.';
	});

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['form_status'] && this.form_status() === true) {
			this.form_bolt11().get(this.toggle_control())?.disable();
		}
	}

	/* *******************************************************
		Actions Up
	******************************************************** */

	public onToggle(event: MatSlideToggleChange): void {
		this.form_bolt11().get(this.toggle_control())?.setValue(event.checked);
		this.update.emit({
			nut: this.nut(),
			unit: this.unit(),
			method: this.method(),
			form_group: this.form_group(),
			control_name: this.toggle_control(),
		});
	}
}
