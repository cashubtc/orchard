/* Application Dependencies */
import {CurrencyType} from '@client/modules/cache/services/local-storage/local-storage.types';
/* Local Dependencies */
import {LocalAmountPipe} from './local-amount.pipe';

/** Strips the formatting markup so assertions read against the rendered text */
function text(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function buildPipe(type_btc = CurrencyType.CODE, type_fiat = CurrencyType.CODE): LocalAmountPipe {
	const mock_setting_service = {
		getLocale: () => 'en-US',
		getCurrency: () => ({type_btc, type_fiat}),
	};
	return new LocalAmountPipe(mock_setting_service as any);
}

describe('LocalAmountPipe', () => {
	it('create an instance', () => {
		expect(buildPipe()).toBeTruthy();
	});

	describe('btc units', () => {
		it('should render sat as a whole number', () => {
			expect(text(buildPipe().transform(123456, 'sat'))).toBe('123,456 sat');
		});

		it('should render msat as whole sat', () => {
			expect(text(buildPipe().transform(1500, 'msat'))).toBe('2 sat');
		});

		it('should render sat with a glyph when configured', () => {
			expect(text(buildPipe(CurrencyType.GLYPH).transform(500, 'sat'))).toBe('₿ 500');
		});
	});

	describe('fiat units', () => {
		it('should render mint cents as dollars', () => {
			expect(text(buildPipe().transform(215, 'usd'))).toBe('2.15 USD');
		});

		it('should render mint cents with a glyph when configured', () => {
			expect(text(buildPipe(CurrencyType.CODE, CurrencyType.GLYPH).transform(215, 'usd'))).toBe('$ 2.15');
		});

		it('should render eur with its own glyph', () => {
			expect(text(buildPipe(CurrencyType.CODE, CurrencyType.GLYPH).transform(215, 'eur'))).toBe('€ 2.15');
		});

		it('should not convert outside the mint section', () => {
			expect(text(buildPipe().transform(2.15, 'usd', 'lightning'))).toBe('2.15 USD');
		});
	});

	describe('custom units', () => {
		it('should render an unknown unit as a whole number with its own code', () => {
			expect(text(buildPipe().transform(123456, 'ora'))).toBe('123,456 ora');
		});

		it('should not apply a glyph to an unknown unit', () => {
			expect(text(buildPipe(CurrencyType.GLYPH, CurrencyType.GLYPH).transform(3776, 'ora'))).toBe('3,776 ora');
		});
	});
});
