/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {resolveDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {AllSystemMetricsSettings, NonNullableSystemMetricsSettings} from '@client/modules/settings/types/setting.types';
/* Native Dependencies */
import {METRICS_RETENTION_DAYS, METRICS_PRESET_META} from '@client/modules/system/constants/system.constants';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

/** Oldest possible sample given the server retention window (used for the AllTime preset) */
export function getMetricsGenesisTime(): number {
	return Math.floor(DateTime.now().minus({days: METRICS_RETENTION_DAYS}).startOf('day').toSeconds());
}

/** Resolves a metrics preset to a rolling window of exactly (now − duration → now), no calendar snapping */
export function resolveMetricsDateRangePreset(
	preset: DateRangePreset,
	now: DateTime = DateTime.now(),
): {date_start: number; date_end: number} {
	const meta = METRICS_PRESET_META[preset];
	if (!meta) return resolveDateRangePreset(preset, getMetricsGenesisTime(), now);
	return {date_start: now.minus(meta.duration).toUnixInteger(), date_end: now.toUnixInteger()};
}

/** Suggested chart interval for a metrics preset, or null when the preset has no mapping */
export function suggestMetricsInterval(preset: DateRangePreset | null | undefined): SystemMetricsInterval | null {
	return preset != null ? (METRICS_PRESET_META[preset]?.interval ?? null) : null;
}

/** Re-resolves the rolling window for preset-driven settings; static custom ranges pass through unchanged */
export function refreshMetricsRange(settings: NonNullableSystemMetricsSettings): NonNullableSystemMetricsSettings {
	if (!settings.date_preset) return settings;
	return {...settings, ...resolveMetricsDateRangePreset(settings.date_preset)};
}

/** True when settings describe a live rolling minute window (sub-day minute preset) that should auto-advance */
export function shouldAutoRefreshMetrics(settings: NonNullableSystemMetricsSettings | null): boolean {
	if (!settings || settings.interval !== SystemMetricsInterval.Minute || !settings.date_preset) return false;
	return METRICS_PRESET_META[settings.date_preset]?.interval === SystemMetricsInterval.Minute;
}

/** Resolves stored device settings into fully-defaulted page settings for a first visit */
export function resolveSystemMetricsSettings(settings: AllSystemMetricsSettings): NonNullableSystemMetricsSettings {
	const date_preset = settings.date_preset ?? null;
	const resolved_dates = date_preset ? resolveMetricsDateRangePreset(date_preset) : null;
	const default_dates = resolveMetricsDateRangePreset(DateRangePreset.Last7Days);
	return {
		date_start: resolved_dates?.date_start ?? settings.date_start ?? default_dates.date_start,
		date_end: resolved_dates?.date_end ?? settings.date_end ?? default_dates.date_end,
		date_preset,
		interval: settings.interval ?? suggestMetricsInterval(date_preset ?? DateRangePreset.Last7Days) ?? SystemMetricsInterval.Hour,
	};
}
