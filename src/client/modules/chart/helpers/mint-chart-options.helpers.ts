/* Vendor Dependencies */
import {TimeUnit} from 'chart.js';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';
import type {UnitFamily} from '@client/modules/local/types/unit.types';
/* Shared Dependencies */
import {AnalyticsInterval} from '@shared/generated.types';

/** Fallback axis title used when no unit of that family is present */
const FAMILY_FALLBACK_LABEL: Record<UnitFamily, string> = {btc: 'SAT', fiat: 'FIAT', custom: 'UNITS'};

/** Groups the distinct display codes of the supplied units by family, in encounter order */
function getCodesByFamily(units: (string | undefined)[]): Record<UnitFamily, string[]> {
	const codes_by_family: Record<UnitFamily, string[]> = {btc: [], fiat: [], custom: []};
	for (const unit of units) {
		if (!unit) continue;
		const meta = getUnitMeta(unit);
		if (!codes_by_family[meta.family].includes(meta.code)) codes_by_family[meta.family].push(meta.code);
	}
	return codes_by_family;
}

/** Axis title listing the units it carries, e.g. `USD / EUR` */
function getAxisLabel(units: (string | undefined)[], family: UnitFamily): string {
	const codes = getCodesByFamily(units)[family];
	return codes.length ? codes.join(' / ') : FAMILY_FALLBACK_LABEL[family];
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
	const codes_by_family = getCodesByFamily(units);
	const families: UnitFamily[] = ['btc', 'fiat', 'custom'];
	return families.filter((family) => codes_by_family[family].length).map((family) => `y${family}`);
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

export function getUnitYAxisConfig({
	units,
	family,
	show_grid,
	grid_color,
	begin_at_zero,
	locale,
	position,
	is_cents,
}: {
	units: (string | undefined)[];
	family: UnitFamily;
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
			text: getAxisLabel(units, family),
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
