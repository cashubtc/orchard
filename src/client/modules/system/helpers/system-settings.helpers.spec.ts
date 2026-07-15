/* Application Dependencies */
import {resolveDateRangePreset} from '@client/modules/form/helpers/form-daterange.helpers';
import {DateRangePreset} from '@client/modules/form/types/form-daterange.types';
import {AllSystemMetricsSettings} from '@client/modules/settings/types/setting.types';
/* Native Dependencies */
import {resolveSystemMetricsSettings, getMetricsGenesisTime} from './system-settings.helpers';
/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

/** Builds a settings object with all fields nulled unless overridden */
const settings = (overrides: Partial<AllSystemMetricsSettings> = {}): AllSystemMetricsSettings => ({
	date_start: null,
	date_end: null,
	date_preset: null,
	interval: null,
	...overrides,
});

describe('system-settings.helpers', () => {
	describe('getMetricsGenesisTime', () => {
		it('returns a positive unix-second timestamp in the past', () => {
			const genesis = getMetricsGenesisTime();
			const now = Math.floor(Date.now() / 1000);
			expect(genesis).toBeGreaterThan(0);
			expect(genesis).toBeLessThan(now);
			// ~90 days ago, allow a day of slack for start-of-day flooring
			expect(now - genesis).toBeGreaterThan(89 * 86400);
			expect(now - genesis).toBeLessThan(91 * 86400);
		});
	});

	describe('resolveSystemMetricsSettings', () => {
		it('defaults to a Last7Days range and hourly interval on a first visit', () => {
			const defaults = resolveDateRangePreset(DateRangePreset.Last7Days);
			const resolved = resolveSystemMetricsSettings(settings());
			expect(resolved.date_start).toBe(defaults.date_start);
			expect(resolved.date_end).toBe(defaults.date_end);
			expect(resolved.date_preset).toBeNull();
			expect(resolved.interval).toBe(SystemMetricsInterval.Hour);
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

		it('lets a preset override stored explicit dates', () => {
			const preset_dates = resolveDateRangePreset(DateRangePreset.Last30Days, getMetricsGenesisTime());
			const resolved = resolveSystemMetricsSettings(
				settings({date_preset: DateRangePreset.Last30Days, date_start: 111, date_end: 222}),
			);
			expect(resolved.date_start).toBe(preset_dates.date_start);
			expect(resolved.date_end).toBe(preset_dates.date_end);
			expect(resolved.date_preset).toBe(DateRangePreset.Last30Days);
		});

		it('anchors the AllTime preset to the retention genesis time', () => {
			const resolved = resolveSystemMetricsSettings(settings({date_preset: DateRangePreset.AllTime}));
			expect(resolved.date_start).toBe(getMetricsGenesisTime());
		});

		it('falls back to the hourly interval when none is stored', () => {
			expect(resolveSystemMetricsSettings(settings({interval: null})).interval).toBe(SystemMetricsInterval.Hour);
		});
	});
});
