/* Vendor Dependencies */
import {Duration} from 'luxon';

/** Formats a duration in seconds into a compact human label (e.g. "3d 4h 12m") */
export function formatUptime(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined || seconds <= 0) return '—';
	const duration = Duration.fromObject({seconds}).shiftTo('days', 'hours', 'minutes');
	const days = Math.floor(duration.days);
	const hours = Math.floor(duration.hours);
	const minutes = Math.floor(duration.minutes);
	const parts: string[] = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
	return parts.join(' ');
}
