/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output, signal} from '@angular/core';
import {FormGroup} from '@angular/forms';
/* Application Dependencies */
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
/* Shared Dependencies */
import {OrchardNut4Method, OrchardNut5Method} from '@shared/generated.types';

/** Onchain limits and stats, adding the read-only confirmations count */
@Component({
	selector: 'orc-mint-subsection-config-form-onchain',
	standalone: false,
	templateUrl: './mint-subsection-config-form-onchain.component.html',
	styleUrl: './mint-subsection-config-form-onchain.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionConfigFormOnchainComponent {
	public nut = input.required<'nut4' | 'nut5'>(); // which nut configuration this controls
	public unit = input.required<string>(); // unit to display (e.g. 'sat')
	public method = input.required<string>(); // payment method (e.g. 'onchain')
	public form_group = input.required<FormGroup>(); // form group containing the method controls
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

	public confirmation_options: number[] = Array.from({length: 12}, (_, index) => index + 1); // selectable confirmation counts

	public form_onchain = computed<FormGroup>(() => {
		return this.form_group().get(this.unit())?.get(this.method()) as FormGroup;
	});
}
