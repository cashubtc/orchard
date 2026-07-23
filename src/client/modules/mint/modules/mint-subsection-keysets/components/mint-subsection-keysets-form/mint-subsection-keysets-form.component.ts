/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output, signal, computed} from '@angular/core';
import {FormGroup} from '@angular/forms';
/* Vendor Dependencies */
import {MatChipEditedEvent, MatChipInputEvent} from '@angular/material/chips';
import {MatSelectChange} from '@angular/material/select';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {DateTime} from 'luxon';
/* Native Dependencies */
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
/* Shared Dependencies */
import {MintUnit} from '@shared/generated.types';

@Component({
	selector: 'orc-mint-subsection-keysets-form',
	standalone: false,
	templateUrl: './mint-subsection-keysets-form.component.html',
	styleUrl: './mint-subsection-keysets-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionKeysetsFormComponent {
	public readonly mint_type = input.required<string>();
	public readonly form_group = input.required<FormGroup>();
	public readonly unit_options = input.required<{value: string; label: string}[]>();
	public readonly keyset_out = input.required<MintKeyset>();
	public readonly keyset_out_balance = input.required<MintBalance | undefined>();
	public readonly median_notes = input.required<number>();

	public readonly close = output<void>();
	public readonly updateUnit = output<MintUnit>();

	public help_unit = signal<boolean>(false);
	public help_fee = signal<boolean>(true);
	public help_amounts = signal<boolean>(false);
	public help_final_expiry = signal<boolean>(true);
	public advanced = signal<boolean>(false);

	public readonly today = DateTime.now();

	public readonly keyset_v2_desc = computed(() => {
		return this.mint_type() === 'nutshell' ? 'Unsupported in Nutshell' : '33 byte keyset IDs';
	});

	public readonly separatorKeysCodes = [ENTER, COMMA] as const;

	public get keyset_in_fee_estimate(): number {
		const fee_ppk = this.form_group().get('input_fee_ppk')?.value;
		const median_notes = this.median_notes;
		if (fee_ppk > 0 && median_notes() === 0) return 1;
		return Math.floor((median_notes() * fee_ppk + 999) / 1000);
	}

	public onUnitChange(event: MatSelectChange): void {
		this.updateUnit.emit(event.value);
	}

	/** Regenerates amounts as powers of 2 based on the slider value. */
	public onMaxOrderChange(): void {
		const max_order = this.form_group().get('max_order')?.value;
		if (max_order == null || max_order < 1) return;
		const amounts = Array.from({length: max_order}, (_, i) => Math.pow(2, i));
		this.form_group().get('amounts')?.setValue(amounts);
	}

	/** Adds a new amount to the amounts form control. */
	public addAmount(event: MatChipInputEvent): void {
		const value = (event.value || '').trim();
		const parsed = Number(value);
		if (value && !isNaN(parsed) && parsed > 0) {
			const amounts: number[] = [...(this.form_group().get('amounts')?.value ?? [])];
			amounts.push(parsed);
			this.form_group().get('amounts')?.setValue(amounts);
		}
		event.chipInput!.clear();
	}

	/** Removes an amount from the amounts form control. */
	public removeAmount(amount: number): void {
		const amounts: number[] = [...(this.form_group().get('amounts')?.value ?? [])];
		const index = amounts.indexOf(amount);
		if (index >= 0) {
			amounts.splice(index, 1);
			this.form_group().get('amounts')?.setValue(amounts);
		}
	}

	/** Edits an existing amount in the amounts form control. */
	public editAmount(amount: number, event: MatChipEditedEvent): void {
		const value = event.value.trim();
		const parsed = Number(value);
		if (!value || isNaN(parsed) || parsed <= 0) {
			this.removeAmount(amount);
			return;
		}
		const amounts: number[] = [...(this.form_group().get('amounts')?.value ?? [])];
		const index = amounts.indexOf(amount);
		if (index >= 0) {
			amounts[index] = parsed;
			this.form_group().get('amounts')?.setValue(amounts);
		}
	}
}
