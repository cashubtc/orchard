/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Local Dependencies */
import {getDateRangePresetLabel, isSubDayDateRangePreset, resolveDateRangePreset} from './form-daterange.helpers';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';

describe('form-daterange.helpers', () => {
	// Fixed anchor so rolling windows resolve deterministically
	const now = DateTime.fromISO('2026-07-21T15:30:00', {zone: 'utc'});

	describe('resolveDateRangePreset', () => {
		it('resolves Last15Minutes to a rolling now-relative window without day snapping', () => {
			const resolved = resolveDateRangePreset(DateRangePreset.Last15Minutes, 0, now);
			expect(resolved.date_end).toBe(now.toUnixInteger());
			expect(resolved.date_start).toBe(now.minus({minutes: 15}).toUnixInteger());
			expect(resolved.date_end - resolved.date_start).toBe(15 * 60);
		});

		it('resolves each rolling window to its exact span ending at now', () => {
			const cases: [DateRangePreset, number][] = [
				[DateRangePreset.Last5Minutes, 5 * 60],
				[DateRangePreset.Last30Minutes, 30 * 60],
				[DateRangePreset.Last1Hour, 60 * 60],
				[DateRangePreset.Last6Hours, 6 * 60 * 60],
				[DateRangePreset.Last12Hours, 12 * 60 * 60],
				[DateRangePreset.Last24Hours, 24 * 60 * 60],
			];
			for (const [preset, span] of cases) {
				const resolved = resolveDateRangePreset(preset, 0, now);
				expect(resolved.date_end).toBe(now.toUnixInteger());
				expect(resolved.date_end - resolved.date_start).toBe(span);
			}
		});

		it('snaps day-granularity presets to day boundaries', () => {
			const resolved = resolveDateRangePreset(DateRangePreset.Last2Days, 0, now);
			expect(resolved.date_end).toBe(Math.floor(now.endOf('day').toSeconds()));
			expect(resolved.date_start).toBe(Math.floor(now.minus({days: 2}).startOf('day').toSeconds()));
		});

		it('snaps Last90Days to the retention-window boundary', () => {
			const resolved = resolveDateRangePreset(DateRangePreset.Last90Days, 0, now);
			expect(resolved.date_end).toBe(Math.floor(now.endOf('day').toSeconds()));
			expect(resolved.date_start).toBe(Math.floor(now.minus({days: 90}).startOf('day').toSeconds()));
		});
	});

	describe('isSubDayDateRangePreset', () => {
		it('is true for rolling sub-day presets', () => {
			expect(isSubDayDateRangePreset(DateRangePreset.Last5Minutes)).toBe(true);
			expect(isSubDayDateRangePreset(DateRangePreset.Last15Minutes)).toBe(true);
			expect(isSubDayDateRangePreset(DateRangePreset.Last24Hours)).toBe(true);
		});

		it('is false for day-granularity presets and null', () => {
			expect(isSubDayDateRangePreset(DateRangePreset.Last2Days)).toBe(false);
			expect(isSubDayDateRangePreset(DateRangePreset.Last7Days)).toBe(false);
			expect(isSubDayDateRangePreset(null)).toBe(false);
			expect(isSubDayDateRangePreset(undefined)).toBe(false);
		});
	});

	describe('getDateRangePresetLabel', () => {
		it('returns the human-readable label for a preset', () => {
			expect(getDateRangePresetLabel(DateRangePreset.Last5Minutes)).toBe('Last 5 minutes');
			expect(getDateRangePresetLabel(DateRangePreset.Last1Hour)).toBe('Last 1 hour');
		});

		it('returns an empty string for a preset outside the metrics list or null', () => {
			expect(getDateRangePresetLabel(DateRangePreset.ThisQuarter)).toBe('');
			expect(getDateRangePresetLabel(null)).toBe('');
		});
	});
});
