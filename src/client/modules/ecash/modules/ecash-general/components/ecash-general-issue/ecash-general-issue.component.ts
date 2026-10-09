/* Core Dependencies */
import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal} from '@angular/core';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup, Validators} from '@angular/forms';
/* Vendor Dependencies */
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {OrchardValidators} from '@client/modules/form/validators';
import {applyKeypadKey} from '@client/modules/form/helpers/form-keypad.helpers';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {compareUnits, fromDisplayAmount, getUnitMeta, toDisplayAmount} from '@client/modules/local/helpers/unit.helpers';
import {MintService} from '@client/modules/mint/services/mint/mint.service';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
import {getSolvencyMultiple, getUnitLiabilities} from '@client/modules/mint/helpers/mint-solvency.helpers';
/* Native Dependencies */
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
/* Shared Dependencies */
import {WalletOperationState} from '@shared/generated.types';

@Component({
	selector: 'orc-ecash-general-issue',
	standalone: false,
	templateUrl: './ecash-general-issue.component.html',
	styleUrl: './ecash-general-issue.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralIssueComponent implements OnInit {
	private readonly ecashService = inject(EcashService);
	private readonly mintService = inject(MintService);
	private readonly eventService = inject(EventService);
	private readonly panelRef = inject(FormPanelRef);
	private readonly destroyRef = inject(DestroyRef);
	public readonly data: {mint: EcashMint} = inject(FORM_PANEL_DATA);

	/** The host opened this panel as a bottom sheet */
	public readonly sheet: boolean = inject(MatBottomSheetRef, {optional: true}) !== null;
	public readonly units: string[] = [...this.data.mint.issue_units].sort(compareUnits);
	public readonly form = new FormGroup({
		amount: new FormControl<number | null>(null),
		memo: new FormControl<string>(''),
	});

	public readonly unit = signal<string>(this.units[0] ?? 'sat');
	public readonly submitting = signal<boolean>(false);
	public readonly focused_amount = signal<boolean>(false);
	public readonly focused_memo = signal<boolean>(false);
	public readonly help_amount = signal<boolean>(false);
	public readonly help_memo = signal<boolean>(false);
	public readonly amount = toSignal(this.form.controls.amount.valueChanges, {initialValue: null});
	public readonly amount_status = toSignal(this.form.controls.amount.statusChanges, {initialValue: 'VALID'});

	public readonly can_submit = computed(() => (this.amount() ?? 0) > 0 && this.amount_status() === 'VALID' && !this.submitting());

	/** Fraction digits the amount is entered with, e.g. cents for usd */
	public readonly decimals = computed(() => getUnitMeta(this.unit()).decimals);

	/** The entered amount in the unit's base units, as the mint counts it */
	public readonly base_amount = computed(() => {
		const amount = this.amount();
		return amount === null ? null : fromDisplayAmount(this.unit(), amount);
	});

	/** The mint's own limits for issuing in the selected unit, in base units */
	public readonly limits = computed(() => {
		const method = this.data.mint.getIssueMethod(this.unit());
		return {min: method?.min_amount ?? null, max: method?.max_amount ?? null};
	});

	/** Liabilities, reserves and coverage before and after this issue; bitcoin units only, as reserves back nothing else */
	public readonly preview = computed(() => {
		const reserves = this.reserves();
		const unit = this.unit();
		if (!reserves || getUnitMeta(unit).family !== 'btc') return null;
		const liabilities_before = getUnitLiabilities(reserves, unit);
		const liabilities_after = liabilities_before + (this.base_amount() ?? 0);
		return {
			liabilities_before,
			liabilities_after,
			reserves: reserves.reserves,
			coverage_before: getSolvencyMultiple(reserves.reserves, liabilities_before, unit),
			coverage_after: getSolvencyMultiple(reserves.reserves, liabilities_after, unit),
		};
	});

	private readonly reserves = signal<MintReserves | null>(null);
	private readonly keypad_text = signal<string>('');

	constructor() {
		effect(() => this.applyLimits());
	}

	ngOnInit(): void {
		this.loadReserves();
	}

	/* *******************************************************
		Data
	******************************************************** */

	/** The mint's reserves, for the balance sheet preview; without them the preview stays hidden */
	private loadReserves(): void {
		this.mintService
			.loadMintReserves()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (reserves) => this.reserves.set(reserves),
				error: (error) => console.error(error),
			});
	}

	/** Sets the amount from the keypad's text, as an edit, so its field turns hot and shows the mint's limits */
	private setKeypadText(text: string): void {
		this.keypad_text.set(text);
		this.form.controls.amount.setValue(text === '' ? null : Number(text));
		this.form.controls.amount.markAsDirty();
		this.form.controls.amount.markAsTouched();
	}

	/** Holds the amount, entered in display units, to the unit's precision and the mint's limits */
	private applyLimits(): void {
		const unit = this.unit();
		const {min, max} = this.limits();
		const validators = [OrchardValidators.decimals(this.decimals())];
		if (min !== null) validators.push(Validators.min(toDisplayAmount(unit, min)));
		if (max !== null) validators.push(Validators.max(toDisplayAmount(unit, max)));
		this.form.controls.amount.setValidators(validators);
		this.form.controls.amount.updateValueAndValidity();
	}

	/* *******************************************************
		Actions
	******************************************************** */

	/** Switches the unit, clearing an amount entered at the old unit's precision */
	public onUnit(unit: string): void {
		this.unit.set(unit);
		this.keypad_text.set('');
		this.form.controls.amount.reset();
	}

	/** Applies a keypad key to the amount, within the unit's precision */
	public onKey(key: string): void {
		this.setKeypadText(applyKeypadKey(this.keypad_text(), key, this.decimals()));
	}

	/** Clears a field back to where it started */
	public onCancel(event: Event, field: 'amount' | 'memo'): void {
		event.preventDefault();
		this.form.controls[field].reset();
		if (field === 'amount') this.keypad_text.set('');
	}

	/** Issues the amount and closes with the operation; a refusal keeps the panel open and shows the server's own message */
	public onSubmit(): void {
		const amount = this.base_amount();
		if (!amount || !this.can_submit()) return;
		this.submitting.set(true);
		const memo = this.form.controls.memo.value?.trim() || null;
		this.ecashService
			.issueEcash(this.unit(), amount, memo)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (operation) => {
					const finalized = operation.state === WalletOperationState.Finalized;
					const message = finalized ? 'Ecash issued!' : 'Issue started, it finishes on its own';
					this.eventService.registerEvent(new EventData({type: 'SUCCESS', message}));
					this.panelRef.close(operation);
				},
				error: (errors: OrchardErrors) => {
					this.submitting.set(false);
					this.eventService.registerEvent(new EventData({type: 'ERROR', message: errors.errors[0].getFullError()}));
				},
			});
	}

	/** Closes the panel without issuing */
	public onClose(): void {
		this.panelRef.close();
	}
}
