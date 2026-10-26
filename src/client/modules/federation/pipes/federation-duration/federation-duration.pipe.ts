/* Core Dependencies */
import {inject, Pipe, type PipeTransform} from '@angular/core';

/* Vendor Dependencies */
import {Duration} from 'luxon';

/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';

@Pipe({
	name: 'federationDuration',
	pure: true,
})
export class FederationDurationPipe implements PipeTransform {
	private readonly setting_device_service = inject(SettingDeviceService);

	/** Render a reported uint64 duration in the device locale, leaving unknown or oversized values verbatim. */
	public transform(value: string | number | null | undefined, unit: 'seconds' | 'milliseconds' = 'seconds'): string {
		if (value == null) return 'Not reported';
		const text = String(value);
		const amount = Number(text);
		if (!/^\d+$/.test(text) || !Number.isSafeInteger(amount)) return text;
		const duration = Duration.fromObject({[unit]: amount}, {locale: this.setting_device_service.getLocale()});
		return (amount === 0 ? duration : duration.rescale()).toHuman({unitDisplay: 'short'});
	}
}
