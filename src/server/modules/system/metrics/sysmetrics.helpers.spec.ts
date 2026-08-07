/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {getBucketDate, bucketMinMaxAvg} from './sysmetrics.helpers.js';
import {SystemMetricsInterval} from './sysmetrics.enums.js';

describe('sysmetrics.helpers', () => {
	describe('getBucketDate', () => {
		const hour_start = 1710028800; // an exact hour (and day) boundary in UTC

		it('truncates to the start of the minute for the minute interval', () => {
			expect(getBucketDate(hour_start + 90, SystemMetricsInterval.minute, 'UTC')).toBe(hour_start + 60);
		});

		it('truncates to the start of the hour for the hour interval', () => {
			expect(getBucketDate(hour_start + 1800, SystemMetricsInterval.hour, 'UTC')).toBe(hour_start);
		});

		it('truncates to the start of the day for the day interval', () => {
			expect(getBucketDate(hour_start + 3600, SystemMetricsInterval.day, 'UTC')).toBe(hour_start);
		});

		it('respects the supplied timezone when bucketing by day', () => {
			// hour_start is 2024-03-10T00:00:00Z; in New York it is still 2024-03-09
			const ny_day_start = getBucketDate(hour_start, SystemMetricsInterval.day, 'America/New_York');
			expect(ny_day_start).toBeLessThan(hour_start);
		});
	});

	describe('bucketMinMaxAvg', () => {
		const hour_start = 1710028800;

		it('returns an empty array for no rows', () => {
			expect(bucketMinMaxAvg([], SystemMetricsInterval.hour, 'UTC')).toEqual([]);
		});

		it('computes avg/min/max across values in a single bucket', () => {
			const result = bucketMinMaxAvg(
				[
					{date: hour_start, value: 20},
					{date: hour_start + 60, value: 80},
					{date: hour_start + 120, value: 50},
				],
				SystemMetricsInterval.hour,
				'UTC',
			);

			expect(result).toEqual([{date: hour_start, avg: 50, min: 20, max: 80}]);
		});

		it('skips rows with a null value', () => {
			const result = bucketMinMaxAvg(
				[
					{date: hour_start, value: null},
					{date: hour_start + 60, value: 10},
				],
				SystemMetricsInterval.hour,
				'UTC',
			);

			expect(result).toEqual([{date: hour_start, avg: 10, min: 10, max: 10}]);
		});

		it('returns buckets sorted by date ascending', () => {
			const result = bucketMinMaxAvg(
				[
					{date: hour_start + 3600, value: 5},
					{date: hour_start, value: 1},
				],
				SystemMetricsInterval.hour,
				'UTC',
			);

			expect(result.map((b) => b.date)).toEqual([hour_start, hour_start + 3600]);
		});
	});
});
