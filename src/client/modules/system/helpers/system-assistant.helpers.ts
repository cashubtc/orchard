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

/** Parses assistant yyyy-MM-dd date strings into a [start, end] unix-second range */
export function parseAssistantDateRange(date_start: string, date_end: string): number[] {
	return [
		DateTime.fromFormat(date_start, 'yyyy-MM-dd').toUnixInteger(),
		DateTime.fromFormat(date_end, 'yyyy-MM-dd').toUnixInteger(),
	];
}
