/* Core Dependencies */
import {inject, Pipe, type PipeTransform} from '@angular/core';

/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';

@Pipe({
	name: 'federationCount',
	pure: true,
})
export class FederationCountPipe implements PipeTransform {
	private readonly setting_device_service = inject(SettingDeviceService);

	private static readonly formatters = new Map<string, Intl.NumberFormat>();

	/** Format a uint64 counter through BigInt so it stays exact; `bps` renders basis points as a percentage. */
	public transform(value: string | number | null | undefined, unit?: 'bps'): string {
		if (value == null) return 'Not reported';
		const text = String(value);
		if (!/^\d+$/.test(text)) return text;
		const locale = this.setting_device_service.getLocale();
		if (unit === 'bps') return this.getFormatter(locale, 'percent').format(Number(text) / 10000);
		return this.getFormatter(locale, 'decimal').format(BigInt(text));
	}

	/** Reuse one formatter per locale and style instead of building one for every value. */
	private getFormatter(locale: string, style: 'decimal' | 'percent'): Intl.NumberFormat {
		const key = `${locale}|${style}`;
		let formatter = FederationCountPipe.formatters.get(key);
		if (!formatter) {
			formatter = new Intl.NumberFormat(locale, {style, maximumFractionDigits: 2});
			FederationCountPipe.formatters.set(key, formatter);
		}
		return formatter;
	}
}
