/* Local Dependencies */
import {EventData} from './event-data.class';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('EventData', () => {
	it('assigns a v4 uuid as id (works in non-secure-context browsers, unlike crypto.randomUUID)', () => {
		const event = new EventData({type: 'PENDING'});
		expect(event.id).toMatch(UUID_V4_REGEX);
	});

	it('produces a unique id per instance', () => {
		const ids = new Set(Array.from({length: 100}, () => new EventData({type: 'PENDING'}).id));
		expect(ids.size).toBe(100);
	});
});
