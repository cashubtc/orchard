export enum DateRangePreset {
	Last5Minutes = 'last_5_minutes',
	Last15Minutes = 'last_15_minutes',
	Last30Minutes = 'last_30_minutes',
	Last1Hour = 'last_1_hour',
	Last6Hours = 'last_6_hours',
	Last12Hours = 'last_12_hours',
	Last24Hours = 'last_24_hours',
	Last2Days = 'last_2_days',
	Last7Days = 'last_7_days',
	Last30Days = 'last_30_days',
	Last90Days = 'last_90_days',
	ThisQuarter = 'this_quarter',
	ThisYear = 'this_year',
	LastYear = 'last_year',
	AllTime = 'all_time',
}

export type DateRangePresetOption = {
	label: string;
	value: DateRangePreset;
};

/** Rolling sub-day windows — these resolve to now-relative timestamps and never snap to day boundaries */
export const SUB_DAY_DATE_RANGE_PRESET_OPTIONS: DateRangePresetOption[] = [
	{label: 'Last 5 minutes', value: DateRangePreset.Last5Minutes},
	{label: 'Last 15 minutes', value: DateRangePreset.Last15Minutes},
	{label: 'Last 30 minutes', value: DateRangePreset.Last30Minutes},
	{label: 'Last 1 hour', value: DateRangePreset.Last1Hour},
	{label: 'Last 6 hours', value: DateRangePreset.Last6Hours},
	{label: 'Last 12 hours', value: DateRangePreset.Last12Hours},
	{label: 'Last 24 hours', value: DateRangePreset.Last24Hours},
];

/** Default day-granularity presets used by the shared picker's non-metrics consumers */
export const DATE_RANGE_PRESET_OPTIONS: DateRangePresetOption[] = [
	{label: 'Last 7 days', value: DateRangePreset.Last7Days},
	{label: 'Last 30 days', value: DateRangePreset.Last30Days},
	{label: 'Last 90 days', value: DateRangePreset.Last90Days},
	{label: 'This Quarter', value: DateRangePreset.ThisQuarter},
	{label: 'This Year', value: DateRangePreset.ThisYear},
	{label: 'Last Year', value: DateRangePreset.LastYear},
	{label: 'All Time', value: DateRangePreset.AllTime},
];

/** Metrics surfaces offer rolling sub-day windows plus day presets, capped at the 90-day retention window */
export const METRICS_DATE_RANGE_PRESET_OPTIONS: DateRangePresetOption[] = [
	...SUB_DAY_DATE_RANGE_PRESET_OPTIONS,
	{label: 'Last 2 days', value: DateRangePreset.Last2Days},
	{label: 'Last 7 days', value: DateRangePreset.Last7Days},
	{label: 'Last 30 days', value: DateRangePreset.Last30Days},
	{label: 'Last 90 days', value: DateRangePreset.Last90Days},
];
