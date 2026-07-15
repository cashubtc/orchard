/* Native Dependencies */
import {formatBytesSize} from './system-info.helpers';

describe('system-info.helpers', () => {
	describe('formatBytesSize', () => {
		it('returns a dash for null, undefined and non-positive input', () => {
			expect(formatBytesSize(null)).toBe('—');
			expect(formatBytesSize(undefined)).toBe('—');
			expect(formatBytesSize(0)).toBe('—');
			expect(formatBytesSize(-1)).toBe('—');
		});

		it('formats whole gigabytes without a decimal', () => {
			expect(formatBytesSize(16 * 1024 ** 3)).toBe('16 GB');
		});

		it('formats fractional gigabytes to one decimal place', () => {
			expect(formatBytesSize(1.5 * 1024 ** 3)).toBe('1.5 GB');
		});

		it('switches to terabytes at the 1000 GB threshold', () => {
			expect(formatBytesSize(1000 * 1024 ** 3)).toBe('1 TB');
		});

		it('formats fractional terabytes to one decimal place', () => {
			expect(formatBytesSize(1.5 * 1024 ** 4)).toBe('1.5 TB');
		});
	});
});
