/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Native Dependencies */
import {AnalyticsInterval} from './analytics.enums.js';

/**
 * Computes the interval bucket start date for a given timestamp
 * @param {number} date - Unix timestamp to bucket
 * @param {AnalyticsInterval} interval - The bucketing interval
 * @param {string} timezone - IANA timezone string
 * @param {number} [date_start] - Optional start date for custom intervals
 * @param {{date: number}[]} [data] - Optional data array for custom interval fallback
 * @returns {number} The bucket start timestamp
 */
export function getBucketDate(
	date: number,
	interval: AnalyticsInterval,
	timezone: string,
	date_start?: number,
	data?: {date: number}[],
): number {
	if (interval === AnalyticsInterval.custom) {
		return date_start ?? (data?.length ? Math.min(...data.map((d) => d.date)) : 0);
	}

	const dt = DateTime.fromSeconds(date, {zone: timezone});

	switch (interval) {
		case AnalyticsInterval.day:
			return dt.startOf('day').toUnixInteger();
		case AnalyticsInterval.week:
			return dt.startOf('week').toUnixInteger();
		case AnalyticsInterval.month:
			return dt.startOf('month').toUnixInteger();
		default:
			return dt.startOf('hour').toUnixInteger();
	}
}
