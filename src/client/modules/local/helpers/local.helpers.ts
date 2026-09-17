/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Native Dependencies */
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';

export function getCurrencySymbol(unit: string): string {
	const meta = getUnitMeta(unit);
	return meta.glyph ?? meta.code;
}

/* *******************************************************
	Cron
******************************************************** */

const CRON_RANGES: [number, number][] = [
	[0, 59], // minute
	[0, 23], // hour
	[1, 31], // day of month
	[1, 12], // month
	[0, 6], // day of week (0 = Sunday)
];

/** Parses a single cron field into a Set of valid integer values */
function parseCronField(field: string, index: number): Set<number> | null {
	const [min, max] = CRON_RANGES[index];
	const values = new Set<number>();

	for (const part of field.split(',')) {
		const trimmed = part.trim();

		/* Wildcard with optional step: * or star/N */
		if (trimmed === '*' || trimmed.startsWith('*/')) {
			const step = trimmed === '*' ? 1 : parseInt(trimmed.slice(2), 10);
			if (isNaN(step) || step < 1) return null;
			for (let i = min; i <= max; i += step) values.add(i);
			continue;
		}

		/* Range with optional step: N-M or N-M/S */
		if (trimmed.includes('-')) {
			const [range_part, step_part] = trimmed.split('/');
			const [start_str, end_str] = range_part.split('-');
			const start = parseInt(start_str, 10);
			const end = parseInt(end_str, 10);
			const step = step_part ? parseInt(step_part, 10) : 1;
			if (isNaN(start) || isNaN(end) || isNaN(step) || step < 1) return null;
			for (let i = start; i <= end; i += step) values.add(i);
			continue;
		}

		/* Single value */
		const num = parseInt(trimmed, 10);
		if (isNaN(num) || num < min || num > max) return null;
		values.add(num);
	}

	return values.size > 0 ? values : null;
}

/**
 * Computes the next DateTime that matches a 5-field cron expression.
 * Evaluates in the given IANA timezone (defaults to UTC).
 * Returns null on parse failure or if no match is found within ~4 years.
 */
export function nextCronDate(expr: string, timezone?: string): DateTime | null {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) return null;

	const minutes = parseCronField(parts[0], 0);
	const hours = parseCronField(parts[1], 1);
	const doms = parseCronField(parts[2], 2);
	const months = parseCronField(parts[3], 3);
	const dows = parseCronField(parts[4], 4);
	if (!minutes || !hours || !doms || !months || !dows) return null;

	const dom_any = parts[2] === '*';
	const dow_any = parts[4] === '*';

	let dt = DateTime.now()
		.setZone(timezone ?? 'UTC')
		.plus({minutes: 1})
		.set({second: 0, millisecond: 0});
	const ceiling = dt.plus({years: 4});

	while (dt < ceiling) {
		/* Month */
		if (!months.has(dt.month)) {
			dt = dt.plus({months: 1}).set({day: 1, hour: 0, minute: 0});
			continue;
		}

		/* Day: if both dom and dow are restricted, match EITHER (standard cron behavior) */
		const dom_match = dom_any || doms.has(dt.day);
		const dow_match = dow_any || dows.has(dt.weekday % 7); // Luxon weekday: 1=Mon..7=Sun → % 7 gives 0=Sun
		const day_ok = (dom_any && dow_any) || (dom_any ? dow_match : dow_any ? dom_match : dom_match || dow_match);
		if (!day_ok) {
			dt = dt.plus({days: 1}).set({hour: 0, minute: 0});
			continue;
		}

		/* Hour */
		if (!hours.has(dt.hour)) {
			dt = dt.plus({hours: 1}).set({minute: 0});
			continue;
		}

		/* Minute */
		if (!minutes.has(dt.minute)) {
			dt = dt.plus({minutes: 1});
			continue;
		}

		return dt;
	}

	return null;
}
