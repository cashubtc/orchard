/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	Injector,
	afterNextRender,
	computed,
	effect,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {FormControl, FormGroup, Validators} from '@angular/forms';
/* Vendor Dependencies */
import {MatBottomSheetRef} from '@angular/material/bottom-sheet';
import {filter, take} from 'rxjs';
/* Application Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA} from '@client/modules/form/services/form-panel/form-panel.types';
import {OrchardValidators} from '@client/modules/form/validators';
import {applyKeypadKey} from '@client/modules/form/helpers/form-keypad.helpers';
import {EventService} from '@client/modules/event/services/event/event.service';
import {EventData} from '@client/modules/event/classes/event-data.class';
import {OrchardErrors} from '@client/modules/error/classes/error.class';
import {compareUnits, fromDisplayAmount, getUnitMeta, toDisplayAmount} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashIssuePanelData, EcashUnitChip} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
/* Shared Dependencies */
import {WalletOperationState} from '@shared/generated.types';

@Component({
	selector: 'orc-ecash-general-issue',
	standalone: false,
	templateUrl: './ecash-general-issue.component.html',
	styleUrl: './ecash-general-issue.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralIssueComponent {
	private readonly ecashService = inject(EcashService);
	private readonly eventService = inject(EventService);
	private readonly panelRef = inject(FormPanelRef);
	private readonly destroyRef = inject(DestroyRef);
	private readonly injector = inject(Injector);
	public readonly data: EcashIssuePanelData = inject(FORM_PANEL_DATA);

	/** The host opened this panel as a bottom sheet */
	public readonly sheet: boolean = inject(MatBottomSheetRef, {optional: true}) !== null;
	public readonly units: string[] = [...this.data.mint.issue_units].sort(compareUnits);
	public readonly form = new FormGroup({
		amount: new FormControl<number | null>(null),
		memo: new FormControl<string>(''),
	});

	public readonly unit = signal<string>(
		this.data.unit && this.units.includes(this.data.unit) ? this.data.unit : (this.units[0] ?? 'sat'),
	);
	public readonly amount_text = signal<string>('');
	public readonly submitting = signal<boolean>(false);
	public readonly focused_memo = signal<boolean>(false);
	public readonly memo_open = signal<boolean>(false);
	public readonly help_memo = signal<boolean>(false);
	public readonly amount = toSignal(this.form.controls.amount.valueChanges, {initialValue: null});
	public readonly amount_status = toSignal(this.form.controls.amount.statusChanges, {initialValue: 'VALID'});

	/** Each unit the mint issues in, with what the wallet holds there */
	public readonly unit_chips = computed<Required<EcashUnitChip>[]>(() =>
		this.units.map((unit) => ({
			unit,
			amount: this.data.balances().find((balance) => balance.unit.toLowerCase() === unit)?.balance ?? 0,
		})),
	);

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

	/** What the wallet holds in the selected unit on this mint */
	public readonly unit_balance = computed(() => this.unit_chips().find((chip) => chip.unit === this.unit())?.amount ?? 0);

	/** The reserves the issue is weighed against; reserves back bitcoin units only */
	public readonly solvency_reserves = computed(() => (getUnitMeta(this.unit()).family === 'btc' ? this.data.reserves() : null));

	private readonly memo_input = viewChild<ElementRef<HTMLTextAreaElement>>('memo_input');

	constructor() {
		effect(() => this.applyLimits());
	}

	/* *******************************************************
		Form
	******************************************************** */

	/** Sets the amount from its typed text, as an edit, so a breach of the mint's limits shows */
	private setAmountText(text: string): void {
		this.amount_text.set(text);
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
		if (this.submitting()) return;
		this.unit.set(unit);
		this.amount_text.set('');
		this.form.controls.amount.reset();
	}

	/** Applies a key from the amount or the keypad, within the unit's precision */
	public onKey(key: string): void {
		if (this.submitting()) return;
		this.setAmountText(applyKeypadKey(this.amount_text(), key, this.decimals()));
	}

	/** Replaces the amount with pasted or retyped text, still held to the unit's precision */
	public onReplace(text: string): void {
		if (this.submitting()) return;
		this.setAmountText([...text].reduce((amount, key) => applyKeypadKey(amount, key, this.decimals()), ''));
	}

	/** Opens the memo field the sheet keeps folded, focused, or folds it again; a written memo is kept either way */
	public onToggleMemo(): void {
		this.memo_open.update((open) => !open);
		if (this.memo_open()) afterNextRender(() => this.memo_input()?.nativeElement.focus(), {injector: this.injector});
	}

	/** Clears the memo back to where it started */
	public onCancelMemo(event: Event): void {
		event.preventDefault();
		this.form.controls.memo.reset();
	}

	/** Issues the amount and closes with the operation once its success is on screen; the form is locked meanwhile, and a refusal unlocks it with the server's own message */
	public onSubmit(): void {
		const amount = this.base_amount();
		if (!amount || !this.can_submit()) return;
		this.submitting.set(true);
		this.eventService.registerEvent(new EventData({type: 'SAVING'}));
		const memo = this.form.controls.memo.value?.trim() || null;
		this.form.controls.memo.disable();
		this.ecashService
			.issueEcash(this.unit(), amount, memo)
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (operation) => {
					const finalized = operation.state === WalletOperationState.Finalized;
					const success = new EventData({
						type: 'SUCCESS',
						message: finalized ? 'Ecash issued!' : 'Issue started, it finishes on its own',
					});
					this.panelRef.setResult(operation);
					this.eventService
						.getActiveEvent()
						.pipe(
							filter((event) => event === success),
							take(1),
							takeUntilDestroyed(this.destroyRef),
						)
						.subscribe(() => this.panelRef.close());
					this.eventService.registerEvent(success);
				},
				error: (errors: OrchardErrors) => {
					this.submitting.set(false);
					this.form.controls.memo.enable();
					this.eventService.registerEvent(new EventData({type: 'ERROR', message: errors.errors[0].getFullError()}));
				},
			});
	}

	/** Closes the panel without issuing */
	public onClose(): void {
		this.panelRef.close();
	}
}
