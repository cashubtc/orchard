/* Core Dependencies */
import {Pipe, PipeTransform} from '@angular/core';
/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {CurrencyType} from '@client/modules/cache/services/local-storage/local-storage.types';
/* Native Dependencies */
import {getUnitMeta, toDisplayAmount, type UnitMeta} from '@client/modules/local/helpers/unit.helpers';

@Pipe({
	name: 'localAmount',
	standalone: false,
	pure: true,
})
export class LocalAmountPipe implements PipeTransform {
	constructor(private settingDeviceService: SettingDeviceService) {}

	transform(amount: number | null, unit: string, section?: string, abbreviate: boolean = false, unitless: boolean = false): string {
		if (amount === null || amount === undefined) return '';
		const locale = this.settingDeviceService.getLocale();
		const currency = this.settingDeviceService.getCurrency();
		const meta = getUnitMeta(unit);

		if (meta.family === 'btc') {
			if (meta.decimals > 0) return this.transformBtc(amount, locale, meta);
			return this.transformSat(toDisplayAmount(unit, amount), locale, currency.type_btc, abbreviate, unitless);
		}
		if (meta.family === 'fiat')
			return this.transformFiat(amount, unit, meta, locale, currency.type_fiat, section, abbreviate, unitless);
		return this.transformStandard(amount, locale, meta.code, abbreviate, unitless);
	}

	/**
	 * Abbreviates a number with K/M/B suffixes
	 */
	private abbreviateAmount(value: number, locale: string): string {
		const abs_value = Math.abs(value);
		if (abs_value >= 1_000_000_000) {
			return (value / 1_000_000_000).toLocaleString(locale, {maximumFractionDigits: 1}) + 'b';
		}
		if (abs_value >= 1_000_000) {
			return (value / 1_000_000).toLocaleString(locale, {maximumFractionDigits: 1}) + 'm';
		}
		if (abs_value >= 1_000) {
			return (value / 1_000).toLocaleString(locale, {maximumFractionDigits: 1}) + 'k';
		}
		return value.toLocaleString(locale);
	}

	private transformSat(amount: number, locale: string, currency: CurrencyType, abbreviate: boolean, unitless: boolean): string {
		const sat_string = abbreviate ? this.abbreviateAmount(amount, locale) : amount.toLocaleString(locale);
		if (unitless) return sat_string;
		switch (currency) {
			case CurrencyType.GLYPH:
				return this.formatPreceding(sat_string, '₿');
			case CurrencyType.CODE:
				return this.formatStandard(sat_string, 'sat');
			default:
				return this.formatStandard(sat_string, 'sat');
		}
	}

	private transformBtc(amount: number, locale: string, meta: UnitMeta): string {
		const btc_string = amount.toLocaleString(locale, {minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals});
		return this.formatStandard(btc_string, meta.code);
	}

	private transformFiat(
		amount: number,
		unit: string,
		meta: UnitMeta,
		locale: string,
		currency: CurrencyType,
		section?: string,
		abbreviate: boolean = false,
		unitless: boolean = false,
	): string {
		let fiat_amount = amount;
		/* Mint amounts arrive in minor units (215 -> 2.15); other sections pass values already converted */
		if (section === 'mint' || section === undefined) fiat_amount = toDisplayAmount(unit, amount);
		const fiat_amount_string = abbreviate
			? this.abbreviateAmount(fiat_amount, locale)
			: fiat_amount.toLocaleString(locale, {minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals});
		if (unitless) return fiat_amount_string;
		switch (currency) {
			case CurrencyType.GLYPH:
				return this.formatPreceding(fiat_amount_string, meta.glyph ?? meta.code);
			case CurrencyType.CODE:
				return this.formatStandard(fiat_amount_string, meta.code);
			default:
				return this.formatStandard(fiat_amount_string, meta.code);
		}
	}

	private transformStandard(amount: number, locale: string, unit: string, abbreviate: boolean, unitless: boolean): string {
		const amount_string = abbreviate ? this.abbreviateAmount(amount, locale) : amount.toLocaleString(locale);
		return unitless ? amount_string : this.formatStandard(amount_string, unit);
	}

	private formatStandard(amount_string: string, unit: string): string {
		return `
			<span class="orc-amount-standard">
				<span class="orc-amount">
					${amount_string}
				</span>
				<span class="orc-unit">
					${unit}
				</span>
			</span>
		`;
	}

	private formatPreceding(amount_string: string, unit: string): string {
		return `
        <span class="orc-amount-preceding">
            <span class="orc-unit">
                ${unit}
            </span>
            <span class="orc-amount">
                ${amount_string}
            </span>
        </span>
        `;
	}
}
