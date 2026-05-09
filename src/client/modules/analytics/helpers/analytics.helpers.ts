/* Vendor Dependencies */
import {DateTime} from 'luxon';

/**
 * Returns the Unix second strictly before the UTC hour-bucket containing `date_start`.
 * Used to bound a "pre-range" analytics query so it can never share an hour bucket
 * with the main range that begins at `date_start`.
 */
export function getPreRangeEnd(date_start: number): number {
	return DateTime.fromSeconds(date_start, {zone: 'UTC'}).startOf('hour').toUnixInteger() - 1;
}
