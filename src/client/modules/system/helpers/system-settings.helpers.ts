/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {resolveDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {AllSystemMetricsSettings, NonNullableSystemMetricsSettings} from '@client/modules/settings/types/setting.types';
/* Native Dependencies */
import {METRICS_RETENTION_DAYS} from '@client/modules/system/constants/system.constants';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

/** Oldest possible sample given the server retention window (used for the AllTime preset) */
export function getMetricsGenesisTime(): number {
	return Math.floor(DateTime.now().minus({days: METRICS_RETENTION_DAYS}).startOf('day').toSeconds());
}

/** Resolves stored device settings into fully-defaulted page settings for a first visit */
export function resolveSystemMetricsSettings(settings: AllSystemMetricsSettings): NonNullableSystemMetricsSettings {
	const date_preset = settings.date_preset ?? null;
	const resolved_dates = date_preset ? resolveDateRangePreset(date_preset, getMetricsGenesisTime()) : null;
	const default_dates = resolveDateRangePreset(DateRangePreset.Last7Days);
	return {
		date_start: resolved_dates?.date_start ?? settings.date_start ?? default_dates.date_start,
		date_end: resolved_dates?.date_end ?? settings.date_end ?? default_dates.date_end,
		date_preset,
		interval: settings.interval ?? SystemMetricsInterval.Hour,
	};
}
