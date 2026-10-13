/* Local Dependencies */
import {getNumberSeparator} from './local.helpers';

describe('LocalHelpers', () => {
	describe('getNumberSeparator', () => {
		it("gives the locale's decimal and grouping characters", () => {
			expect(getNumberSeparator('en-US', 'decimal')).toBe('.');
			expect(getNumberSeparator('en-US', 'group')).toBe(',');
			expect(getNumberSeparator('de-DE', 'decimal')).toBe(',');
			expect(getNumberSeparator('de-DE', 'group')).toBe('.');
		});
	});
});
