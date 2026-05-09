/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Local Dependencies */
import {getPreRangeEnd} from './analytics.helpers';

describe('getPreRangeEnd', () => {
	it('returns the second before the UTC hour-floor of date_start', () => {
		const dt = DateTime.fromISO('2026-03-15T14:37:42Z', {zone: 'UTC'});
		const date_start = dt.toUnixInteger();
		const expected = dt.startOf('hour').toUnixInteger() - 1;
		expect(getPreRangeEnd(date_start)).toBe(expected);
	});

	it('returns date_start - 1 when date_start is exactly on an hour boundary', () => {
		const date_start = DateTime.fromISO('2026-03-15T14:00:00Z', {zone: 'UTC'}).toUnixInteger();
		expect(getPreRangeEnd(date_start)).toBe(date_start - 1);
	});

	it('lands in a different UTC hour than date_start (no shared bucket)', () => {
		const date_start = DateTime.fromISO('2026-03-15T14:37:42Z', {zone: 'UTC'}).toUnixInteger();
		const result = getPreRangeEnd(date_start);
		const result_hour = DateTime.fromSeconds(result, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		const start_hour = DateTime.fromSeconds(date_start, {zone: 'UTC'}).startOf('hour').toUnixInteger();
		expect(result_hour).toBeLessThan(start_hour);
	});
});
