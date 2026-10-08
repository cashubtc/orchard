import {Directive, ElementRef, HostListener, Inject, Input, LOCALE_ID} from '@angular/core';
import {MAT_INPUT_VALUE_ACCESSOR} from '@angular/material/input';
import {NgControl} from '@angular/forms';

@Directive({
	selector: 'input[formNumberSeparator]',
	standalone: false,
	providers: [{provide: MAT_INPUT_VALUE_ACCESSOR, useExisting: FormNumberSeparatorDirective}],
})
export class FormNumberSeparatorDirective {
	private static readonly DIGIT_RE = /\d/;
	private static readonly SEPARATOR_SAMPLE = 1234567.5;

	private _value!: string | null;
	private decimals = 0;
	private formatter: Intl.NumberFormat;
	private readonly group_separator: string;
	private readonly decimal_separator: string;

	get value(): string | null {
		return this._value;
	}

	@Input('value')
	set value(value: string | null) {
		this._value = value;
		this.formatAndDisplay(value);
	}

	/** Fraction digits the amount takes, typed with the locale's decimal separator; 0 keeps it whole */
	@Input()
	set number_decimals(decimals: number) {
		this.decimals = decimals;
		this.formatter = this.buildFormatter();
		this.formatAndDisplay(this._value);
	}

	constructor(
		private elementRef: ElementRef<HTMLInputElement>,
		private ngControl: NgControl,
		@Inject(LOCALE_ID) private locale: string,
	) {
		ngControl.valueAccessor = this;
		this.formatter = this.buildFormatter();
		this.group_separator = this.detectSeparator('group', ',');
		this.decimal_separator = this.detectSeparator('decimal', '.');
	}

	private _onChange(_value: any): void {}

	private buildFormatter(): Intl.NumberFormat {
		return new Intl.NumberFormat(this.locale, {
			useGrouping: true,
			minimumFractionDigits: this.decimals,
			maximumFractionDigits: this.decimals,
		});
	}

	private detectSeparator(type: 'group' | 'decimal', fallback: string): string {
		const parts = new Intl.NumberFormat(this.locale).formatToParts(FormNumberSeparatorDirective.SEPARATOR_SAMPLE);
		return parts.find((part) => part.type === type)?.value ?? fallback;
	}

	/** Whether a character is part of the amount: a digit, or the decimal separator when the amount takes decimals */
	private isAmountChar(char: string): boolean {
		return FormNumberSeparatorDirective.DIGIT_RE.test(char) || (this.decimals > 0 && char === this.decimal_separator);
	}

	/** The amount's characters alone: digits, then one decimal separator and at most the allowed fraction digits */
	private cleanAmount(value: string): string {
		const chars = [...value].filter((char) => this.isAmountChar(char)).join('');
		const [integer, ...fraction] = chars.split(this.decimal_separator);
		if (fraction.length === 0) return integer;
		return `${integer}${this.decimal_separator}${fraction.join('').slice(0, this.decimals)}`;
	}

	/**
	 * Formats a numeric value via Intl (normalizes leading zeros) and sets it on the input element
	 */
	private formatAndDisplay(value: string | null) {
		const el = this.elementRef.nativeElement;
		if (value !== null && value !== '') {
			const num = Number(value);
			el.value = !isNaN(num) ? this.formatter.format(num) : '';
		} else {
			el.value = '';
		}
		this.ngControl?.control?.markAsTouched();
	}

	/**
	 * Inserts locale group separators into a raw digit string, preserving leading zeros
	 */
	private insertGroupSeparators(digits: string): string {
		if (digits.length <= 3) return digits;
		const parts: string[] = [];
		let i = digits.length;
		while (i > 0) {
			parts.unshift(digits.slice(Math.max(0, i - 3), i));
			i -= 3;
		}
		return parts.join(this.group_separator);
	}

	private countAmountCharsUpTo(str: string, pos: number): number {
		let count = 0;
		for (let i = 0; i < pos && i < str.length; i++) {
			if (this.isAmountChar(str[i])) count++;
		}
		return count;
	}

	private findPositionForAmountCharCount(str: string, char_count: number): number {
		if (char_count <= 0) return 0;
		let count = 0;
		for (let i = 0; i < str.length; i++) {
			if (this.isAmountChar(str[i])) {
				count++;
				if (count === char_count) return i + 1;
			}
		}
		return str.length;
	}

	/**
	 * Regroups the amount's integer part, emits the numeric value, and restores cursor position
	 */
	private applyEditedAmount(amount: string, target_position: number) {
		const el = this.elementRef.nativeElement;
		const [integer, fraction] = amount.split(this.decimal_separator);
		const num = amount === '' ? null : Number(amount.replace(this.decimal_separator, '.'));
		this._value = num !== null ? num.toString() : null;
		this._onChange(num);

		const grouped = this.insertGroupSeparators(integer);
		const formatted = fraction === undefined ? grouped : `${grouped}${this.decimal_separator}${fraction}`;
		el.value = formatted;

		const new_cursor = this.findPositionForAmountCharCount(formatted, target_position);
		el.setSelectionRange(new_cursor, new_cursor);
	}

	/**
	 * Handles Backspace/Delete when cursor is adjacent to a group separator.
	 * Skips the separator and removes the neighboring digit instead.
	 */
	private handleSeparatorDeletion(value: string, cursor: number, direction: 'backward' | 'forward') {
		const amount = this.cleanAmount(value);
		const char_index =
			direction === 'backward' ? this.countAmountCharsUpTo(value, cursor - 1) : this.countAmountCharsUpTo(value, cursor);
		const remove_index = direction === 'backward' ? char_index - 1 : char_index;
		const edited = amount.slice(0, remove_index) + amount.slice(remove_index + 1);
		this.applyEditedAmount(edited, direction === 'backward' ? remove_index : char_index);
	}

	@HostListener('input', ['$event'])
	onInput(_event: Event) {
		const el = this.elementRef.nativeElement;
		const raw_value = el.value;
		const cursor_pos = el.selectionStart ?? raw_value.length;
		this.applyEditedAmount(this.cleanAmount(raw_value), this.countAmountCharsUpTo(raw_value, cursor_pos));
	}

	@HostListener('blur')
	_onBlur() {
		this.formatAndDisplay(this._value);
		this.ngControl?.control?.markAsTouched();
	}

	@HostListener('keydown', ['$event'])
	onKeyDown(event: KeyboardEvent) {
		const el = this.elementRef.nativeElement;
		const cursor = el.selectionStart ?? 0;
		const value = el.value;
		const has_selection = cursor !== el.selectionEnd;

		switch (event.key) {
			case 'Backspace':
				if (!has_selection && cursor > 1 && value[cursor - 1] === this.group_separator) {
					event.preventDefault();
					this.handleSeparatorDeletion(value, cursor, 'backward');
				}
				break;
			case 'Delete':
				if (!has_selection && cursor < value.length && value[cursor] === this.group_separator) {
					event.preventDefault();
					this.handleSeparatorDeletion(value, cursor, 'forward');
				}
				break;
			case 'ArrowUp':
			case 'ArrowDown': {
				event.preventDefault();
				const current_value = this._value ? Number(this._value) : 0;
				const new_value = current_value + (event.key === 'ArrowUp' ? 1 : -1);
				this._value = new_value.toString();
				this._onChange(new_value);
				el.value = this.formatter.format(new_value);
				this.ngControl?.control?.markAsTouched();
				break;
			}
		}
	}

	writeValue(value: any) {
		this._value = value !== null && value !== undefined ? value.toString() : null;
		this.formatAndDisplay(this._value);
	}

	registerOnChange(fn: (value: any) => void) {
		this._onChange = fn;
	}

	registerOnTouched() {}
}
