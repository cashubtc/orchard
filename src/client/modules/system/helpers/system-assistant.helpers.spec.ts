/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Native Dependencies */
import {parseAssistantDateRange} from './system-assistant.helpers';

describe('system-assistant.helpers', () => {
	describe('parseAssistantDateRange', () => {
		it('parses the final date through the end of its calendar day', () => {
			const range = parseAssistantDateRange('2025-01-01', '2025-01-31');

			expect(range).toEqual([
				DateTime.fromFormat('2025-01-01', 'yyyy-MM-dd').startOf('day').toUnixInteger(),
				DateTime.fromFormat('2025-01-31', 'yyyy-MM-dd').endOf('day').toUnixInteger(),
			]);
		});

		it('returns null for malformed or impossible dates', () => {
			expect(parseAssistantDateRange('not-a-date', '2025-01-31')).toBeNull();
			expect(parseAssistantDateRange('2025-01-01', '2025-02-30')).toBeNull();
		});

		it('returns null when the end date precedes the start date', () => {
			expect(parseAssistantDateRange('2025-02-01', '2025-01-31')).toBeNull();
		});
	});
});
