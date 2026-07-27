/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {AllSystemMetricsSettings, NonNullableSystemMetricsSettings} from '@client/modules/settings/types/setting.types';
/* Native Dependencies */
import {
	resolveSystemMetricsSettings,
	resolveMetricsDateRangePreset,
	suggestMetricsInterval,
	refreshMetricsRange,
	shouldAutoRefreshMetrics,
	getMetricsGenesisTime,
} from './system-settings.helpers';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

/** Fixed reference time so rolling spans can be asserted exactly (UTC avoids DST-length days) */
const now = DateTime.fromSeconds(1_750_000_000, {zone: 'utc'});

/** Builds a stored-settings object with all fields nulled unless overridden */
const settings = (overrides: Partial<AllSystemMetricsSettings> = {}): AllSystemMetricsSettings => ({
	date_start: null,
	date_end: null,
	date_preset: null,
	interval: null,
	...overrides,
});

/** Builds a resolved page-settings object with static defaults unless overridden */
const page_settings = (overrides: Partial<NonNullableSystemMetricsSettings> = {}): NonNullableSystemMetricsSettings => ({
	date_start: 111,
	date_end: 222,
	date_preset: null,
	interval: SystemMetricsInterval.Hour,
	...overrides,
});

describe('system-settings.helpers', () => {
	describe('getMetricsGenesisTime', () => {
		it('returns a positive unix-second timestamp in the past', () => {
			const genesis = getMetricsGenesisTime();
			const current = Math.floor(Date.now() / 1000);
			expect(genesis).toBeGreaterThan(0);
			expect(genesis).toBeLessThan(current);
			// ~90 days ago, allow a day of slack for start-of-day flooring
			expect(current - genesis).toBeGreaterThan(89 * 86400);
			expect(current - genesis).toBeLessThan(91 * 86400);
		});
	});

	describe('resolveMetricsDateRangePreset', () => {
		it('resolves sub-day presets to rolling windows ending now', () => {
			expect(resolveMetricsDateRangePreset(DateRangePreset.Last5Minutes, now)).toEqual({
				date_start: now.toUnixInteger() - 5 * 60,
				date_end: now.toUnixInteger(),
			});
			expect(resolveMetricsDateRangePreset(DateRangePreset.Last12Hours, now)).toEqual({
				date_start: now.toUnixInteger() - 12 * 3600,
				date_end: now.toUnixInteger(),
			});
		});

		it('resolves Last2Days to exactly 48 hours ending now with no day snapping', () => {
			const resolved = resolveMetricsDateRangePreset(DateRangePreset.Last2Days, now);
			expect(resolved.date_end).toBe(now.toUnixInteger());
			expect(resolved.date_end - resolved.date_start).toBe(2 * 86400);
		});

		it('resolves day presets to rolling N-day windows ending now', () => {
			const resolved_7 = resolveMetricsDateRangePreset(DateRangePreset.Last7Days, now);
			const resolved_90 = resolveMetricsDateRangePreset(DateRangePreset.Last90Days, now);
			expect(resolved_7.date_end - resolved_7.date_start).toBe(7 * 86400);
			expect(resolved_90.date_end - resolved_90.date_start).toBe(90 * 86400);
			expect(resolved_7.date_end).toBe(now.toUnixInteger());
		});

		it('falls back to the shared day-pegged resolver for unmapped presets', () => {
			const resolved = resolveMetricsDateRangePreset(DateRangePreset.AllTime, now);
			expect(resolved.date_start).toBe(getMetricsGenesisTime());
		});
	});

	describe('suggestMetricsInterval', () => {
		it('maps presets to their suggested interval', () => {
			expect(suggestMetricsInterval(DateRangePreset.Last5Minutes)).toBe(SystemMetricsInterval.Minute);
			expect(suggestMetricsInterval(DateRangePreset.Last1Hour)).toBe(SystemMetricsInterval.Minute);
			expect(suggestMetricsInterval(DateRangePreset.Last6Hours)).toBe(SystemMetricsInterval.Hour);
			expect(suggestMetricsInterval(DateRangePreset.Last2Days)).toBe(SystemMetricsInterval.Hour);
			expect(suggestMetricsInterval(DateRangePreset.Last7Days)).toBe(SystemMetricsInterval.Day);
			expect(suggestMetricsInterval(DateRangePreset.Last90Days)).toBe(SystemMetricsInterval.Day);
		});

		it('returns null for unmapped or missing presets', () => {
			expect(suggestMetricsInterval(DateRangePreset.AllTime)).toBeNull();
			expect(suggestMetricsInterval(null)).toBeNull();
			expect(suggestMetricsInterval(undefined)).toBeNull();
		});
	});

	describe('refreshMetricsRange', () => {
		it('re-resolves preset-driven settings to a fresh rolling window', () => {
			const before = Math.floor(Date.now() / 1000);
			const refreshed = refreshMetricsRange(
				page_settings({date_start: 0, date_end: 900, date_preset: DateRangePreset.Last15Minutes}),
			);
			expect(refreshed.date_end).toBeGreaterThanOrEqual(before);
			expect(refreshed.date_end - refreshed.date_start).toBe(15 * 60);
			expect(refreshed.date_preset).toBe(DateRangePreset.Last15Minutes);
			expect(refreshed.interval).toBe(SystemMetricsInterval.Hour);
		});

		it('passes static custom ranges through unchanged', () => {
			const static_settings = page_settings();
			expect(refreshMetricsRange(static_settings)).toBe(static_settings);
		});
	});

	describe('shouldAutoRefreshMetrics', () => {
		it('is true for a rolling minute window', () => {
			expect(
				shouldAutoRefreshMetrics(
					page_settings({interval: SystemMetricsInterval.Minute, date_preset: DateRangePreset.Last15Minutes}),
				),
			).toBe(true);
		});

		it('is false for null settings, static custom ranges, and coarser intervals', () => {
			expect(shouldAutoRefreshMetrics(null)).toBe(false);
			expect(shouldAutoRefreshMetrics(page_settings({interval: SystemMetricsInterval.Minute}))).toBe(false);
			expect(shouldAutoRefreshMetrics(page_settings({date_preset: DateRangePreset.Last6Hours}))).toBe(false);
		});

		it('is false when the minute interval is manually forced onto a long preset', () => {
			expect(
				shouldAutoRefreshMetrics(page_settings({interval: SystemMetricsInterval.Minute, date_preset: DateRangePreset.Last30Days})),
			).toBe(false);
		});
	});

	describe('resolveSystemMetricsSettings', () => {
		it('defaults to a refreshable rolling last-7-days preset and daily interval on a first visit', () => {
			const before = Math.floor(Date.now() / 1000);
			const resolved = resolveSystemMetricsSettings(settings());
			expect(resolved.date_end).toBeGreaterThanOrEqual(before);
			// wall-clock rolling window; allow an hour of slack for DST transitions in the local zone
			expect(Math.abs(resolved.date_end - resolved.date_start - 7 * 86400)).toBeLessThanOrEqual(3600);
			expect(resolved.date_preset).toBe(DateRangePreset.Last7Days);
			expect(resolved.interval).toBe(SystemMetricsInterval.Day);
		});

		it('repairs an incomplete stored range with the rolling default preset', () => {
			const resolved = resolveSystemMetricsSettings(settings({date_start: 111}));
			expect(resolved.date_preset).toBe(DateRangePreset.Last7Days);
			expect(resolved.date_start).not.toBe(111);
		});

		it('uses stored explicit dates and interval when no preset is set', () => {
			const resolved = resolveSystemMetricsSettings(
				settings({date_start: 111, date_end: 222, interval: SystemMetricsInterval.Minute}),
			);
			expect(resolved.date_start).toBe(111);
			expect(resolved.date_end).toBe(222);
			expect(resolved.date_preset).toBeNull();
			expect(resolved.interval).toBe(SystemMetricsInterval.Minute);
		});

		it('lets a preset override stored explicit dates with a fresh rolling window', () => {
			const before = Math.floor(Date.now() / 1000);
			const resolved = resolveSystemMetricsSettings(
				settings({date_preset: DateRangePreset.Last30Days, date_start: 111, date_end: 222}),
			);
			expect(resolved.date_end).toBeGreaterThanOrEqual(before);
			// wall-clock rolling window; allow an hour of slack for DST transitions in the local zone
			expect(Math.abs(resolved.date_end - resolved.date_start - 30 * 86400)).toBeLessThanOrEqual(3600);
			expect(resolved.date_preset).toBe(DateRangePreset.Last30Days);
		});

		it('anchors the AllTime preset to the retention genesis time', () => {
			const resolved = resolveSystemMetricsSettings(settings({date_preset: DateRangePreset.AllTime}));
			expect(resolved.date_start).toBe(getMetricsGenesisTime());
		});

		it('derives the default interval from the stored preset', () => {
			expect(resolveSystemMetricsSettings(settings({date_preset: DateRangePreset.Last5Minutes})).interval).toBe(
				SystemMetricsInterval.Minute,
			);
			expect(resolveSystemMetricsSettings(settings({date_preset: DateRangePreset.Last2Days})).interval).toBe(
				SystemMetricsInterval.Hour,
			);
		});

		it('keeps a stored interval over the preset-derived one', () => {
			const resolved = resolveSystemMetricsSettings(
				settings({date_preset: DateRangePreset.Last5Minutes, interval: SystemMetricsInterval.Day}),
			);
			expect(resolved.interval).toBe(SystemMetricsInterval.Day);
		});

		it('falls back to the hourly interval when no preset or interval is mappable', () => {
			expect(resolveSystemMetricsSettings(settings({date_preset: DateRangePreset.AllTime})).interval).toBe(
				SystemMetricsInterval.Hour,
			);
		});
	});
});
