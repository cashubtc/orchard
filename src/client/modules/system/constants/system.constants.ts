/* Vendor Dependencies */
import {DurationLike} from 'luxon';
/* Application Dependencies */
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

/** Number of days the server retains metric samples */
export const METRICS_RETENTION_DAYS = 90;

/** Rolling window duration and suggested chart interval for each metrics preset */
export const METRICS_PRESET_META: Partial<Record<DateRangePreset, {duration: DurationLike; interval: SystemMetricsInterval}>> = {
	[DateRangePreset.Last5Minutes]: {duration: {minutes: 5}, interval: SystemMetricsInterval.Minute},
	[DateRangePreset.Last15Minutes]: {duration: {minutes: 15}, interval: SystemMetricsInterval.Minute},
	[DateRangePreset.Last30Minutes]: {duration: {minutes: 30}, interval: SystemMetricsInterval.Minute},
	[DateRangePreset.Last1Hour]: {duration: {hours: 1}, interval: SystemMetricsInterval.Minute},
	[DateRangePreset.Last6Hours]: {duration: {hours: 6}, interval: SystemMetricsInterval.Hour},
	[DateRangePreset.Last12Hours]: {duration: {hours: 12}, interval: SystemMetricsInterval.Hour},
	[DateRangePreset.Last24Hours]: {duration: {hours: 24}, interval: SystemMetricsInterval.Hour},
	[DateRangePreset.Last2Days]: {duration: {days: 2}, interval: SystemMetricsInterval.Hour},
	[DateRangePreset.Last7Days]: {duration: {days: 7}, interval: SystemMetricsInterval.Day},
	[DateRangePreset.Last30Days]: {duration: {days: 30}, interval: SystemMetricsInterval.Day},
	[DateRangePreset.Last90Days]: {duration: {days: 90}, interval: SystemMetricsInterval.Day},
};
