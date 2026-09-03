/* Vendor Dependencies */
import {TimeUnit} from 'chart.js';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {getUnitMeta, type UnitFamily} from '@client/modules/local/helpers/unit.helpers';
/* Shared Dependencies */
import {AnalyticsInterval} from '@shared/generated.types';

/** Collects the distinct display codes of the units belonging to one family */
function getFamilyCodes(units: (string | undefined)[], family: UnitFamily): string[] {
	const codes = units.filter((unit): unit is string => !!unit).map((unit) => getUnitMeta(unit));
	return [...new Set(codes.filter((meta) => meta.family === family).map((meta) => meta.code))];
}

function getFiatAxisLabel(units: (string | undefined)[]): string {
	const codes = getFamilyCodes(units, 'fiat');
	return codes.length ? codes.join(' / ') : 'FIAT';
}

function getCustomAxisLabel(units: (string | undefined)[]): string {
	const codes = getFamilyCodes(units, 'custom');
	return codes.length ? codes.join(' / ') : 'UNITS';
}

function convertIntervalToTimeUnit(interval: AnalyticsInterval): TimeUnit {
	const interval_mapping: Record<AnalyticsInterval, TimeUnit> = {
		hour: 'hour',
		day: 'day',
		week: 'week',
		month: 'month',
		custom: 'day',
	};
	return interval_mapping[interval] || 'day';
}

function getTimeTicks(timestamp: number): string {
	return DateTime.fromMillis(timestamp).toLocaleString({
		month: 'short',
		day: 'numeric',
	});
}

/**
 * Formats a number with K/M/B suffixes for axis labels
 * @param value - The numeric value to format
 * @param locale - The locale string for number formatting
 * @returns Formatted string with appropriate suffix (K, M, B)
 */
export function formatAxisValue(value: number, locale?: string): string {
	const abs_value = Math.abs(value);
	if (abs_value >= 1_000_000_000) {
		return (value / 1_000_000_000).toLocaleString(locale, {maximumFractionDigits: 1}) + 'B';
	}
	if (abs_value >= 1_000_000) {
		return (value / 1_000_000).toLocaleString(locale, {maximumFractionDigits: 1}) + 'M';
	}
	if (abs_value >= 1_000) {
		return (value / 1_000).toLocaleString(locale, {maximumFractionDigits: 1}) + 'k';
	}
	return value.toLocaleString(locale);
}

export function getYAxis(units: (string | undefined)[]): string[] {
	const y_axis: string[] = [];
	if (getFamilyCodes(units, 'btc').length) y_axis.push('ybtc');
	if (getFamilyCodes(units, 'fiat').length) y_axis.push('yfiat');
	if (getFamilyCodes(units, 'custom').length) y_axis.push('ycustom');
	return y_axis;
}

export function getTooltipTitle(tooltipItems: any): string {
	if (tooltipItems.length > 0) {
		return DateTime.fromMillis(tooltipItems[0].parsed.x).toLocaleString({
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
	return '';
}

export function getTooltipTitleExact(tooltipItems: any): string {
	if (tooltipItems.length > 0) {
		return DateTime.fromMillis(tooltipItems[0].parsed.x).toLocaleString({
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
		});
	}
	return '';
}

export function getTooltipLabel(context: any, locale: string): string {
	const label = context.dataset.label || '';
	const value = context.parsed.y;
	return `${label}: ${value.toLocaleString(locale)}`;
}

export function getXAxisConfig(selected_interval: AnalyticsInterval, locale: string): any {
	const timeunit = convertIntervalToTimeUnit(selected_interval);
	return {
		type: 'time',
		time: {
			unit: timeunit,
			displayFormats: {
				day: 'short',
			},
			tooltipFormat: 'full',
		},
		adapters: {
			date: {
				locale: locale,
			},
		},
		ticks: {
			source: 'data',
			callback: getTimeTicks,
		},
		bounds: 'data',
		grid: {
			display: false,
		},
	};
}

export function getBtcYAxisConfig({
	grid_color,
	begin_at_zero,
	mark_zero_color,
	locale,
}: {
	grid_color: string;
	begin_at_zero?: boolean;
	mark_zero_color?: string;
	locale?: string;
}): any {
	return {
		position: 'left',
		title: {
			display: true,
			text: 'SAT',
		},
		beginAtZero: begin_at_zero ?? false,
		ticks: {
			callback: (value: string | number) => formatAxisValue(Number(value), locale),
		},
		grid: {
			display: true, // Enable gridlines for ybtc axis
			drawBorder: (_context: any) => {
				return mark_zero_color ? true : false;
			},
			lineWidth: (context: any) => {
				return mark_zero_color ? (context.tick.value === 0 ? 2 : 1) : 1;
			},
			color: (context: any) => {
				return mark_zero_color ? (context.tick.value === 0 ? mark_zero_color : grid_color) : grid_color;
			},
		},
	};
}

export function getFiatYAxisConfig({
	units,
	show_grid,
	grid_color,
	begin_at_zero,
	locale,
	position,
	is_cents,
}: {
	units: (string | undefined)[];
	show_grid: boolean;
	grid_color: string;
	begin_at_zero?: boolean;
	locale?: string;
	position?: 'left' | 'right';
	is_cents?: boolean;
}): any {
	return {
		position: position ?? 'right',
		title: {
			display: true,
			text: getFiatAxisLabel(units),
		},
		beginAtZero: begin_at_zero ?? false,
		ticks: {
			callback: (value: string | number) => {
				const display_value = is_cents ? Number(value) / 100 : Number(value);
				return formatAxisValue(display_value, locale);
			},
		},
		grid: {
			display: show_grid,
			color: grid_color,
		},
	};
}

export function getCustomYAxisConfig({
	units,
	show_grid,
	grid_color,
	begin_at_zero,
	locale,
	position,
}: {
	units: (string | undefined)[];
	show_grid: boolean;
	grid_color: string;
	begin_at_zero?: boolean;
	locale?: string;
	position?: 'left' | 'right';
}): any {
	return {
		position: position ?? 'right',
		title: {
			display: true,
			text: getCustomAxisLabel(units),
		},
		beginAtZero: begin_at_zero ?? false,
		ticks: {
			callback: (value: string | number) => formatAxisValue(Number(value), locale),
		},
		grid: {
			display: show_grid,
			color: grid_color,
		},
	};
}
