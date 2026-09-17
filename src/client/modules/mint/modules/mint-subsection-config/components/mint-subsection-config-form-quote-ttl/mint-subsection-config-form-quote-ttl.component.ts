/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild, effect} from '@angular/core';
import {FormGroup, ValidationErrors} from '@angular/forms';
/* Application Dependencies */
import {MintQuoteTtls} from '@client/modules/mint/classes/mint-quote-ttls.class';
import {MintMeltQuote} from '@client/modules/mint/classes/mint-melt-quote.class';
import {MintMintQuote} from '@client/modules/mint/classes/mint-mint-quote.class';
import {avg, median, max, min} from '@client/modules/math/helpers';
/* Native Dependencies */
import {MintConfigStats} from '@client/modules/mint/modules/mint-subsection-config/types/mint-config-stats.type';
/* Shared Dependencies */
import {MintQuoteState, MeltQuoteState} from '@shared/generated.types';

@Component({
	selector: 'orc-mint-subsection-config-form-quote-ttl',
	standalone: false,
	templateUrl: './mint-subsection-config-form-quote-ttl.component.html',
	styleUrl: './mint-subsection-config-form-quote-ttl.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionConfigFormQuoteTtlComponent {
	public nut = input.required<'nut4' | 'nut5'>(); // which nut configuration this controls
	public form_group = input.required<FormGroup>(); // form group containing the quote ttl control
	public control_name = input.required<keyof MintQuoteTtls>(); // name of the form control to bind
	public control_dirty = input.required<boolean | undefined>(); // whether the control is dirty
	public control_invalid = input.required<boolean | undefined>(); // whether the control is invalid
	public control_errors = input.required<ValidationErrors | null | undefined>(); // errors for the control
	public disabled = input<boolean | undefined>(undefined); // whether the form is disabled
	public locale = input.required<string>(); // locale for number formatting
	public loading = input.required<boolean>(); // whether data is loading
	public quotes = input.required<MintMintQuote[] | MintMeltQuote[]>(); // quotes to display in chart
	public methods = input<string[]>([]); // payment methods this mint advertises for this nut
	public device_desktop = input<boolean>(false); // whether the desktop view is active

	public update = output<{form_group: FormGroup; control_name: keyof MintQuoteTtls}>(); // emitted when form is submitted
	public cancel = output<{form_group: FormGroup; control_name: keyof MintQuoteTtls}>(); // emitted when form is cancelled

	public element_quote_ttl = viewChild.required<ElementRef<HTMLInputElement>>('element_quote_ttl'); // reference to the input element

	public focused_quote_ttl = signal<boolean>(false); // tracks if the input is focused
	public control_touched = signal<boolean>(false); // tracks if the control has been touched
	public help_status = signal<boolean>(false); // tracks if the help is visible
	public stat_deltas = signal<Record<string, number>[]>([]); // deltas for the stats
	public stats = signal<MintConfigStats>({
		avg: 0,
		median: 0,
		max: 0,
		min: 0,
	}); // stats for the quote ttl

	public form_hot = computed(() => {
		if (this.focused_quote_ttl()) return true;
		return this.control_dirty() ?? false;
	});

	/** The bolt11 caveat only carries information when bolt11 sits alongside another advertised method */
	private readonly bolt11_caveat = computed(() => {
		const methods = this.methods();
		if (!methods.includes('bolt11')) return '';
		if (methods.every((method) => method === 'bolt11')) return '';
		return '<br><br><span class="orc-status-warning-color">Note: This setting only applies to the <b>bolt11</b> payment method.</span>';
	});

	public help_text = computed(() => {
		if (this.nut() === 'nut4')
			return `How long a deposit invoice stays valid.<br> After this time, the invoice expires and the user must request a new quote.${this.bolt11_caveat()}`;
		if (this.nut() === 'nut5')
			return 'How long a withdrawal fee quote is locked in.<br> After this time, the quote expires and the user must request a new one.';
		return '';
	});

	public placeholder = computed(() => {
		return this.nut() === 'nut4' ? 'Ex. 3600 (1 hour)' : 'Ex. 60';
	});

	public valid_quotes = computed(() => {
		const quotes = this.nut() === 'nut4' ? (this.quotes() as MintMintQuote[]) : (this.quotes() as MintMeltQuote[]);
		const valid_state = this.nut() === 'nut4' ? MintQuoteState.Issued : MeltQuoteState.Paid;
		return quotes
			.filter((quote) => quote.state === valid_state && quote.created_time && quote.created_time > 0)
			.sort((a, b) => (a.created_time ?? 0) - (b.created_time ?? 0)) as MintMintQuote[] | MintMeltQuote[];
	});

	constructor() {
		effect(() => {
			const loading = this.loading();
			if (!loading) this.setStats();
		});
	}

	private setStats(): void {
		const deltas = this.getDeltas();
		this.stat_deltas.set(deltas);
		const stats = this.getStats(deltas);
		this.stats.set(stats);
	}

	private getDeltas(): Record<string, number>[] {
		const valid_quotes = this.valid_quotes();
		if (valid_quotes.length === 0) return [];
		return valid_quotes.map((quote) => {
			const created_time = quote.created_time ?? 0;
			const end_time = quote instanceof MintMintQuote ? (quote.issued_time ?? quote.paid_time ?? 0) : (quote.paid_time ?? 0);
			return {
				created_time,
				delta: end_time - created_time,
			};
		});
	}

	private getStats(deltas: Record<string, number>[]): {
		avg: number;
		median: number;
		max: number;
		min: number;
	} {
		const values = deltas.map((delta) => delta['delta']);
		return {
			avg: avg(values),
			median: median(values),
			max: max(values),
			min: min(values),
		};
	}

	public onFocus(): void {
		this.focused_quote_ttl.set(true);
	}

	public onBlur(): void {
		this.focused_quote_ttl.set(false);
		this.control_touched.set(true);
	}

	public onSubmit(event: Event): void {
		event.preventDefault();
		this.update.emit({form_group: this.form_group(), control_name: this.control_name()});
		this.element_quote_ttl().nativeElement.blur();
		this.form_group().get(this.control_name())?.markAsPristine();
		this.control_touched.set(false);
		this.focused_quote_ttl.set(false);
	}

	public onCancel(event: Event): void {
		event.preventDefault();
		this.cancel.emit({form_group: this.form_group(), control_name: this.control_name()});
		this.element_quote_ttl().nativeElement.blur();
		this.form_group().get(this.control_name())?.markAsPristine();
		this.control_touched.set(false);
		this.focused_quote_ttl.set(false);
	}
}
