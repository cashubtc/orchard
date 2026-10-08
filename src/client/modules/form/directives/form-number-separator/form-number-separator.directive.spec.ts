/* Core Dependencies */
import {ElementRef} from '@angular/core';
/* Local Dependencies */
import {FormNumberSeparatorDirective} from './form-number-separator.directive';

describe('FormNumberSeparatorDirective', () => {
	/** Builds the directive on a bare input, recording what it emits */
	const build = (locale = 'en-US', decimals = 0) => {
		const input = document.createElement('input');
		const element_ref = {nativeElement: input} as ElementRef<HTMLInputElement>;
		const mock_ng_control = {control: {markAsTouched: () => {}}, valueAccessor: null} as any;
		const directive = new FormNumberSeparatorDirective(element_ref, mock_ng_control, locale);
		const emitted: unknown[] = [];
		directive.registerOnChange((value) => emitted.push(value));
		directive.number_decimals = decimals;
		const type = (text: string) => {
			input.value = text;
			input.setSelectionRange(text.length, text.length);
			directive.onInput(new Event('input'));
		};
		return {input, directive, emitted, type};
	};

	it('should create an instance', () => {
		expect(build().directive).toBeTruthy();
	});

	it('groups whole numbers and ignores a decimal separator', () => {
		const {input, emitted, type} = build();
		type('1234567');
		expect(input.value).toBe('1,234,567');
		expect(emitted.at(-1)).toBe(1234567);
		type('12.5');
		expect(input.value).toBe('125');
	});

	it('takes up to the allowed fraction digits after the decimal separator', () => {
		const {input, emitted, type} = build('en-US', 2);
		type('1234.5');
		expect(input.value).toBe('1,234.5');
		expect(emitted.at(-1)).toBe(1234.5);
		type('1234.567');
		expect(input.value).toBe('1,234.56');
		expect(emitted.at(-1)).toBe(1234.56);
		type('.5');
		expect(emitted.at(-1)).toBe(0.5);
	});

	it("uses the locale's decimal separator", () => {
		const {input, emitted, type} = build('de-DE', 2);
		type('1234,5');
		expect(input.value).toBe('1.234,5');
		expect(emitted.at(-1)).toBe(1234.5);
	});

	it('pads to full precision when a value is loaded and on blur', () => {
		const {input, directive, type} = build('en-US', 2);
		directive.writeValue(5000);
		expect(input.value).toBe('5,000.00');
		type('12.5');
		directive._onBlur();
		expect(input.value).toBe('12.50');
	});
});
