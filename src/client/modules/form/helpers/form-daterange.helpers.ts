/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {
	DateRangePreset,
	METRICS_DATE_RANGE_PRESET_OPTIONS,
	SUB_DAY_DATE_RANGE_PRESET_OPTIONS,
} from '@client/modules/form/types/form-daterange.types';

/** True when the preset is a rolling sub-day window (Last 15 minutes, Last hour, etc.) */
export function isSubDayDateRangePreset(preset: DateRangePreset | null | undefined): boolean {
	return preset != null && SUB_DAY_DATE_RANGE_PRESET_OPTIONS.some((option) => option.value === preset);
}

/** Human-readable label for a preset (e.g. 'Last 15 minutes'), or an empty string when unknown */
export function getDateRangePresetLabel(preset: DateRangePreset | null | undefined): string {
	return METRICS_DATE_RANGE_PRESET_OPTIONS.find((option) => option.value === preset)?.label ?? '';
}

/** Resolves a preset to unix-second timestamps for date_start and date_end */
export function resolveDateRangePreset(
	preset: DateRangePreset,
	genesis_time: number = 0,
	now: DateTime = DateTime.now(),
): {date_start: number; date_end: number} {
	const end_of_today = Math.floor(now.endOf('day').toSeconds());
	switch (preset) {
		case DateRangePreset.Last5Minutes:
			return {date_start: now.minus({minutes: 5}).toUnixInteger(), date_end: now.toUnixInteger()};
		case DateRangePreset.Last15Minutes:
			return {date_start: now.minus({minutes: 15}).toUnixInteger(), date_end: now.toUnixInteger()};
		case DateRangePreset.Last30Minutes:
			return {date_start: now.minus({minutes: 30}).toUnixInteger(), date_end: now.toUnixInteger()};
		case DateRangePreset.Last1Hour:
			return {date_start: now.minus({hours: 1}).toUnixInteger(), date_end: now.toUnixInteger()};
		case DateRangePreset.Last6Hours:
			return {date_start: now.minus({hours: 6}).toUnixInteger(), date_end: now.toUnixInteger()};
		case DateRangePreset.Last12Hours:
			return {date_start: now.minus({hours: 12}).toUnixInteger(), date_end: now.toUnixInteger()};
		case DateRangePreset.Last24Hours:
			return {date_start: now.minus({hours: 24}).toUnixInteger(), date_end: now.toUnixInteger()};
		case DateRangePreset.Last2Days:
			return {date_start: now.minus({days: 2}).startOf('day').toUnixInteger(), date_end: end_of_today};
		case DateRangePreset.Last7Days:
			return {date_start: Math.floor(now.minus({days: 7}).startOf('day').toSeconds()), date_end: end_of_today};
		case DateRangePreset.Last30Days:
			return {date_start: Math.floor(now.minus({days: 30}).startOf('day').toSeconds()), date_end: end_of_today};
		case DateRangePreset.Last90Days:
			return {date_start: Math.floor(now.minus({days: 90}).startOf('day').toSeconds()), date_end: end_of_today};
		case DateRangePreset.ThisQuarter:
			return {date_start: Math.floor(now.startOf('quarter').toSeconds()), date_end: end_of_today};
		case DateRangePreset.ThisYear:
			return {date_start: Math.floor(now.startOf('year').toSeconds()), date_end: end_of_today};
		case DateRangePreset.LastYear: {
			const last_year = now.minus({years: 1});
			return {
				date_start: Math.floor(last_year.startOf('year').toSeconds()),
				date_end: Math.floor(last_year.endOf('year').toSeconds()),
			};
		}
		case DateRangePreset.AllTime:
			return {date_start: genesis_time, date_end: end_of_today};
	}
}
