/* Application Dependencies */
import {getUnitMeta, toDisplayAmountFor} from '@client/modules/local/helpers/unit.helpers';
/* Vendor Dependencies */
import {DateTime, DateTimeUnit} from 'luxon';
/* Shared Dependencies */
import {AnalyticsInterval} from '@shared/generated.types';

export type AnalyticsDataPoint = {unit: string; amount: string; date: number; count?: number | null};
export type AnalyticsGroup = Record<string, AnalyticsDataPoint[]>;

/** Groups analytics data by unit */
export function groupAnalyticsByUnit(analytics: AnalyticsDataPoint[]): AnalyticsGroup {
	return analytics.reduce((groups, analytic) => {
		const unit = analytic.unit;
		groups[unit] = groups[unit] || [];
		groups[unit].push(analytic);
		return groups;
	}, {} as AnalyticsGroup);
}

/** Prepends preceding period data to the first timestamp for cumulative calculations */
export function prependData(analytics: AnalyticsGroup, preceding_data: AnalyticsDataPoint[], timestamp_first: number): AnalyticsGroup {
	if (preceding_data.length === 0) return analytics;
	if (Object.keys(analytics).length === 0)
		return preceding_data.reduce((groups, analytic) => {
			analytic.date = timestamp_first;
			groups[analytic.unit] = groups[analytic.unit] || [];
			groups[analytic.unit].push(analytic);
			return groups;
		}, {} as AnalyticsGroup);

	for (const preceding_item of preceding_data) {
		const unit = preceding_item.unit;
		preceding_item.date = timestamp_first;

		if (!analytics[unit]) {
			analytics[unit] = [preceding_item];
			continue;
		}

		const analytics_for_unit = analytics[unit];
		const matching_datapoint = analytics_for_unit.find((a) => a.date === preceding_item.date);
		if (!matching_datapoint) {
			analytics_for_unit.unshift(preceding_item);
		} else {
			matching_datapoint.amount = String(BigInt(matching_datapoint.amount) + BigInt(preceding_item.amount));
			if (matching_datapoint.count != null && preceding_item.count != null) {
				matching_datapoint.count = matching_datapoint.count + preceding_item.count;
			}
		}
	}
	return analytics;
}

/** Keys analytics data by timestamp, extracting a numeric metric value */
export function getDataKeyedByTimestamp(analytics: AnalyticsDataPoint[], metric: 'amount' | 'count'): Record<number, number> {
	return analytics.reduce(
		(acc, item) => {
			const value = item[metric];
			acc[item.date] = typeof value === 'string' ? Number(value) : (value as number);
			return acc;
		},
		{} as Record<number, number>,
	);
}

/** Generates all possible timestamps between first and last for a given interval */
export function getAllPossibleTimestamps(first_timestamp: number, last_timestamp: number, interval: AnalyticsInterval): number[] {
	const all_possible_timestamps = [];
	let current_time = getValidTimestamp(first_timestamp, interval);
	const last_valid_timestamp = getValidTimestamp(last_timestamp, interval);
	while (current_time <= last_timestamp) {
		all_possible_timestamps.push(current_time);
		current_time = getNextTimestamp(current_time, interval);
	}
	if (!all_possible_timestamps.includes(last_valid_timestamp)) {
		all_possible_timestamps.push(last_valid_timestamp);
	}
	return all_possible_timestamps;
}

function getValidTimestamp(timestamp: number, interval: AnalyticsInterval): number {
	const time_interval = getTimeInterval(interval);
	return DateTime.fromSeconds(timestamp).startOf(time_interval).toSeconds();
}

/** Gets the next timestamp for a given interval */
export function getNextTimestamp(timestamp: number, interval: AnalyticsInterval): number {
	if (interval === AnalyticsInterval.Hour) return DateTime.fromSeconds(timestamp).plus({hours: 1}).toSeconds();
	if (interval === AnalyticsInterval.Day) return DateTime.fromSeconds(timestamp).plus({days: 1}).toSeconds();
	if (interval === AnalyticsInterval.Week) return DateTime.fromSeconds(timestamp).plus({weeks: 1}).toSeconds();
	if (interval === AnalyticsInterval.Month) return DateTime.fromSeconds(timestamp).plus({months: 1}).toSeconds();
	return DateTime.fromSeconds(timestamp).plus({days: 1}).toSeconds();
}

/** Creates chart data points with optional cumulative summing and unit conversion */
export function getAmountData(
	unique_timestamps: number[],
	data_keyed_by_timestamp: Record<number, number>,
	unit: string,
	cumulative: boolean,
): {x: number; y: number}[] {
	const meta = getUnitMeta(unit);
	let running_sum = 0;
	return unique_timestamps.map((timestamp) => {
		const val = toDisplayAmountFor(meta, data_keyed_by_timestamp[timestamp] || 0);
		if (!cumulative) return {x: timestamp * 1000, y: val};
		running_sum += val;
		return {x: timestamp * 1000, y: running_sum};
	});
}

/** Creates chart data points from count values without unit conversion */
export function getCountData(
	unique_timestamps: number[],
	data_keyed_by_timestamp: Record<number, number>,
	cumulative: boolean,
): {x: number; y: number}[] {
	let running_sum = 0;
	return unique_timestamps.map((timestamp) => {
		const val = data_keyed_by_timestamp[timestamp] || 0;
		running_sum += val;
		return {
			x: timestamp * 1000,
			y: cumulative ? running_sum : val,
		};
	});
}

/** Maps AnalyticsInterval to luxon DateTimeUnit */
export function getTimeInterval(interval: AnalyticsInterval): DateTimeUnit {
	if (!interval) return 'day';
	if (interval === AnalyticsInterval.Hour) return 'hour';
	if (interval === AnalyticsInterval.Week) return 'week';
	if (interval === AnalyticsInterval.Month) return 'month';
	return 'day';
}

/** Corrects the last data point with the live balance if it falls in the current period */
export function correctLastPointWithLiveBalance(
	data: {x: number; y: number}[],
	live_balance: number | null,
	interval: AnalyticsInterval,
): {x: number; y: number}[] {
	if (data.length === 0 || live_balance === null) return data;
	const last_point = data[data.length - 1];
	const last_timestamp_sec = last_point.x / 1000;
	const time_unit = getTimeInterval(interval);
	const current_period_start = DateTime.now().startOf(time_unit).toSeconds();
	if (last_timestamp_sec !== current_period_start) return data;
	return [...data.slice(0, -1), {x: last_point.x, y: live_balance}];
}
