/* Core Dependencies */
import {TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {ThemeService} from '@client/modules/settings/services/theme/theme.service';
import {CurrencyType} from '@client/modules/cache/services/local-storage/local-storage.types';
/* Local Dependencies */
import {ChartService} from './chart.service';

describe('ChartService', () => {
	let service: ChartService;
	let setting_device_stub: Partial<SettingDeviceService>;

	beforeEach(() => {
		// Default device-currency settings: glyph for both BTC and fiat (matches
		// `setting-device.service.ts:121` cold-start). The formatter branches on
		// `currency.type_*` to decide between glyph (`₿`, `$`, `€`) and code
		// (`sat`, `USD`, `EUR`); these tests pin the glyph branch since that's
		// what every operator sees on first paint.
		setting_device_stub = {
			getLocale: () => 'en-US',
			getCurrency: () => ({type_btc: CurrencyType.GLYPH, type_fiat: CurrencyType.GLYPH}),
		};
		TestBed.configureTestingModule({
			providers: [
				{provide: SettingDeviceService, useValue: setting_device_stub},
				{provide: ThemeService, useValue: {getThemeColor: () => '#000000'}},
			],
		});
		service = TestBed.inject(ChartService);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	describe('formatTooltipAmount', () => {
		// The contract: input is the data point's `y` value AS THE CHART
		// PIPELINE PRODUCES IT — i.e. already converted to display units by
		// `LocalAmountPipe.getConvertedAmount` upstream in `getAmountData`
		// (analytics-chart-data.helpers.ts:106). For sat/btc that's identity;
		// for usd/eur that's cents/100. The formatter must NOT re-divide —
		// doing so produced the `$0.02` regression on the Fee Revenue chart.
		// These tests pin the contract so reintroducing a `/100` here fails
		// loudly.

		it('formats sat as a glyph-prefixed integer with locale grouping', () => {
			expect(service.formatTooltipAmount(162, 'sat')).toBe('₿162');
			expect(service.formatTooltipAmount(1234567, 'sat')).toBe('₿1,234,567');
		});

		it('formats msat by ceiling-dividing into sat then glyph-formatting', () => {
			// `Math.ceil(1500 / 1000) = 2` → ceiling, not floor: a partial sat
			// counts as one. Mirrors `formatBtcAmount` behavior in
			// chart.service.ts:285-288.
			expect(service.formatTooltipAmount(1500, 'msat')).toBe('₿2');
			expect(service.formatTooltipAmount(1000, 'msat')).toBe('₿1');
		});

		it('formats btc as 8-decimal full string', () => {
			expect(service.formatTooltipAmount(0.00012345, 'btc')).toBe('0.00012345 BTC');
			expect(service.formatTooltipAmount(1, 'btc')).toBe('1.00000000 BTC');
		});

		it('formats usd as $-prefixed 2-decimal — input is ALREADY dollars, not cents', () => {
			// The chart pipeline divides cents by 100 in `getAmountData` before
			// reaching the tooltip callback, so 1.61 here represents 161 cents
			// of fee revenue. A formatter that re-divides by 100 produces $0.02
			// — exactly the bug this test prevents.
			expect(service.formatTooltipAmount(1.61, 'usd')).toBe('$1.61');
			expect(service.formatTooltipAmount(0, 'usd')).toBe('$0.00');
			expect(service.formatTooltipAmount(1234.5, 'usd')).toBe('$1,234.50');
		});

		it('formats eur as €-prefixed 2-decimal — input is ALREADY euros, not cents', () => {
			expect(service.formatTooltipAmount(1.63, 'eur')).toBe('€1.63');
			expect(service.formatTooltipAmount(0, 'eur')).toBe('€0.00');
		});

		it('falls back to bare locale-formatted number for unknown units', () => {
			expect(service.formatTooltipAmount(42, 'unknown')).toBe('42');
		});

		it('formats sat as code suffix when type_btc is CODE instead of GLYPH', () => {
			// When the operator switches device-currency to "code" the formatter
			// must drop the glyph and append the unit code. This branch is
			// what `formatBtcAmount` does at chart.service.ts:287.
			(setting_device_stub as {getCurrency: () => unknown}).getCurrency = () => ({
				type_btc: CurrencyType.CODE,
				type_fiat: CurrencyType.GLYPH,
			});
			expect(service.formatTooltipAmount(162, 'sat')).toBe('162 sat');
		});

		it('formats usd/eur as code suffix when type_fiat is CODE instead of GLYPH', () => {
			(setting_device_stub as {getCurrency: () => unknown}).getCurrency = () => ({
				type_btc: CurrencyType.GLYPH,
				type_fiat: CurrencyType.CODE,
			});
			expect(service.formatTooltipAmount(1.61, 'usd')).toBe('1.61 USD');
			expect(service.formatTooltipAmount(1.63, 'eur')).toBe('1.63 EUR');
		});
	});

	describe('formatOracleTooltipLabel', () => {
		// `formatOracleTooltipLabel` is the Chart.js tooltip-label callback the
		// dashboard charts wire in. It receives `context.raw.y_original` and
		// `context.raw.y_converted` (the latter populated only when the unit is
		// oracle-eligible — sat/msat/btc — see mint-chart-data.helpers.ts:41).
		// y_original is in DISPLAY UNITS (already converted upstream).
		// y_converted, when present, is in USD CENTS (oracleConvertToUSDCents
		// returns cents — see oracle.helpers.ts:16). The /100 in the converted
		// branch is therefore correct: it turns cents into dollars.

		it('formats a non-oracle fiat point with just the original line', () => {
			// usd is not oracle-eligible (no btc/sat conversion needed), so
			// y_converted is null and the oracle branch is skipped.
			const ctx = {
				dataset: {label: 'USD'},
				raw: {y_original: 1.61, y_converted: null, unit: 'usd'},
				parsed: {y: 1.61},
			};
			expect(service.formatOracleTooltipLabel(ctx, false)).toBe('USD: $1.61');
		});

		it('formats a sat point with no oracle conversion when oracle is off', () => {
			const ctx = {
				dataset: {label: 'SAT'},
				raw: {y_original: 162, y_converted: 14000, unit: 'sat'},
				parsed: {y: 162},
			};
			expect(service.formatOracleTooltipLabel(ctx, false)).toBe('SAT: ₿162');
		});

		it('appends oracle USD conversion when oracle is on for an eligible unit', () => {
			// y_converted = 14000 cents = $140.00 — the /100 in the converted
			// branch (chart.service.ts:271) is correct because
			// `oracleConvertToUSDCents` returns cents.
			const ctx = {
				dataset: {label: 'SAT'},
				raw: {y_original: 162, y_converted: 14000, unit: 'sat'},
				parsed: {y: 162},
			};
			expect(service.formatOracleTooltipLabel(ctx, true)).toBe('SAT: ₿162 ($140.00)');
		});

		it('does not append oracle conversion for ineligible units even when oracle is on', () => {
			// usd/eur are display-only fiats; the resolver does not produce a
			// y_converted for them (eligibleForOracleConversion is false), so
			// the converted branch must not fire even when the operator has
			// oracle enabled.
			const ctx = {
				dataset: {label: 'EUR'},
				raw: {y_original: 1.63, y_converted: null, unit: 'eur'},
				parsed: {y: 1.63},
			};
			expect(service.formatOracleTooltipLabel(ctx, true)).toBe('EUR: €1.63');
		});

		it('falls back to bare numeric label when raw point is not an OracleChartDataPoint', () => {
			// Some chart paths produce plain `{x, y}` points without the oracle
			// metadata; the formatter must degrade gracefully.
			const ctx = {
				dataset: {label: 'COUNT'},
				raw: {x: 1, y: 5},
				parsed: {y: 5},
			};
			expect(service.formatOracleTooltipLabel(ctx, false)).toBe('COUNT: 5');
		});
	});
});
