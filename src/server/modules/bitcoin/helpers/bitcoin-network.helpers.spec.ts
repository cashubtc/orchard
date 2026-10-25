/* Local Dependencies */
import {bitcoinNetworksMatch} from './bitcoin-network.helpers.js';

describe('bitcoinNetworksMatch', () => {
	it('maps LND and CLN network names onto Bitcoin Core chains', () => {
		expect(bitcoinNetworksMatch('main', 'mainnet')).toBe(true);
		expect(bitcoinNetworksMatch('main', 'bitcoin')).toBe(true);
		expect(bitcoinNetworksMatch('regtest', 'regtest')).toBe(true);
	});

	it('rejects different or missing networks', () => {
		expect(bitcoinNetworksMatch('signet', 'regtest')).toBe(false);
		expect(bitcoinNetworksMatch('main', undefined)).toBe(false);
	});
});
