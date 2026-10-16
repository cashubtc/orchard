/* Local Dependencies */
import {getMintUri} from './mint-uri.helpers';

describe('getMintUri', () => {
	it('labels clearnet, insecure and onion URLs, shortening long onion hosts', () => {
		expect(getMintUri('https://mint.cedar.example:3338')).toEqual({
			uri: 'https://mint.cedar.example:3338',
			origin: 'https://mint.cedar.example:3338',
			type: 'clearnet',
			label: 'mint.cedar.example:3338',
		});
		expect(getMintUri('http://203.0.113.10').type).toBe('insecure');
		expect(getMintUri('http://cedarmintq7v3xabcdefghij.onion')).toEqual(
			jasmine.objectContaining({type: 'tor', label: 'cedarmintq7v3xa...onion'}),
		);
	});
});
