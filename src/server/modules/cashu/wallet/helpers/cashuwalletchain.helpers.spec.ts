/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {parseOutpoint} from './cashuwalletchain.helpers.js';

describe('parseOutpoint', () => {
	it('splits an outpoint into its txid and output index', () => {
		expect(parseOutpoint(`${'AB'.repeat(32)}:3`)).toEqual({txid: 'ab'.repeat(32), vout: 3});
	});

	it.each(['ab'.repeat(32), `${'ab'.repeat(31)}:0`, `${'ab'.repeat(32)}:-1`, `${'zz'.repeat(32)}:0`])('refuses %s', (outpoint) => {
		expect(parseOutpoint(outpoint)).toBeNull();
	});
});
