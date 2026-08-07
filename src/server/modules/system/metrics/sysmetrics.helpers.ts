/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Native Dependencies */
import {SystemMetricsInterval} from './sysmetrics.enums.js';

/** Avg/min/max summary of the values falling within one interval bucket */
export interface MinMaxAvgBucket {
	date: number;
	avg: number;
	min: number;
	max: number;
}

/**
 * Gets the bucket start timestamp for a given interval in the supplied timezone
 */
export function getBucketDate(date: number, interval: SystemMetricsInterval, timezone: string): number {
	const dt = DateTime.fromSeconds(date, {zone: timezone});

	switch (interval) {
		case SystemMetricsInterval.day:
			return dt.startOf('day').toUnixInteger();
		case SystemMetricsInterval.hour:
			return dt.startOf('hour').toUnixInteger();
		default:
			return dt.startOf('minute').toUnixInteger();
	}
}

/**
 * Buckets rows by interval and computes the avg/min/max value per bucket.
 * Rows with a null value are skipped; buckets are returned sorted by date ascending.
 */
export function bucketMinMaxAvg(
	rows: {date: number; value: number | null}[],
	interval: SystemMetricsInterval,
	timezone: string,
): MinMaxAvgBucket[] {
	type Bucket = {values: number[]; min: number; max: number};
	const buckets = new Map<number, Bucket>();

	for (const row of rows) {
		if (row.value === null) continue;
		const bucket_date = getBucketDate(row.date, interval, timezone);
		const bucket = buckets.get(bucket_date);
		if (bucket) {
			bucket.values.push(row.value);
			bucket.min = Math.min(bucket.min, row.value);
			bucket.max = Math.max(bucket.max, row.value);
		} else {
			buckets.set(bucket_date, {values: [row.value], min: row.value, max: row.value});
		}
	}

	return Array.from(buckets.entries())
		.sort((a, b) => a[0] - b[0])
		.map(([date, bucket]) => ({
			date,
			avg: bucket.values.reduce((sum, v) => sum + v, 0) / bucket.values.length,
			min: bucket.min,
			max: bucket.max,
		}));
}
