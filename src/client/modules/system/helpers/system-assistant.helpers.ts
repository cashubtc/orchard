/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {NonNullableSystemMetricsSettings} from '@client/modules/settings/types/setting.types';

/** Builds the markdown page-context block fed to the assistant for a system metrics page */
export function buildSystemAssistantContext(settings: NonNullableSystemMetricsSettings | null): string {
	let context = `* **Current Date:** ${DateTime.now().toFormat('yyyy-MM-dd')}\n`;
	if (settings) {
		context += `* **Date Start:** ${DateTime.fromSeconds(settings.date_start).toFormat('yyyy-MM-dd')}\n`;
		context += `* **Date End:** ${DateTime.fromSeconds(settings.date_end).toFormat('yyyy-MM-dd')}\n`;
		context += `* **Interval:** ${settings.interval}\n`;
	}
	return context;
}

/**
 * Parses assistant yyyy-MM-dd date strings into an inclusive unix-second day range.
 * @param {string} date_start - First calendar day in the requested range.
 * @param {string} date_end - Last calendar day in the requested range.
 * @returns {[number, number] | null} Inclusive start/end timestamps, or null when either date or the range is invalid.
 */
export function parseAssistantDateRange(date_start: string, date_end: string): [number, number] | null {
	const parsed_start = DateTime.fromFormat(date_start, 'yyyy-MM-dd').startOf('day');
	const parsed_end = DateTime.fromFormat(date_end, 'yyyy-MM-dd').endOf('day');
	if (!parsed_start.isValid || !parsed_end.isValid || parsed_end.toMillis() < parsed_start.toMillis()) return null;
	return [parsed_start.toUnixInteger(), parsed_end.toUnixInteger()];
}
