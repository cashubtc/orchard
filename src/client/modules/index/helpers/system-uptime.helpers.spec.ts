/* Native Dependencies */
import {formatUptime} from './system-uptime.helpers';

describe('system-uptime.helpers', () => {
	describe('formatUptime', () => {
		it('returns a dash for null, undefined and non-positive input', () => {
			expect(formatUptime(null)).toBe('—');
			expect(formatUptime(undefined)).toBe('—');
			expect(formatUptime(0)).toBe('—');
			expect(formatUptime(-42)).toBe('—');
		});

		it('formats days, hours and minutes together', () => {
			// 3d 4h 12m
			expect(formatUptime(3 * 86400 + 4 * 3600 + 12 * 60)).toBe('3d 4h 12m');
		});

		it('omits leading zero segments', () => {
			// 4h 5m — no days
			expect(formatUptime(4 * 3600 + 5 * 60)).toBe('4h 5m');
		});

		it('drops a zero minute segment when higher segments are present', () => {
			// exactly 2h — minutes are zero and other parts exist
			expect(formatUptime(2 * 3600)).toBe('2h');
		});

		it('floors sub-minute remainders', () => {
			// 90s → 1m30s floors to 1m
			expect(formatUptime(90)).toBe('1m');
		});

		it('falls back to 0m when the duration is under a minute', () => {
			expect(formatUptime(30)).toBe('0m');
		});
	});
});
