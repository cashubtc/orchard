/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {chainConfirmations, isDepositCredited, parseOutpoint} from './cashuwalletchain.helpers.js';

describe('parseOutpoint', () => {
	it('splits an outpoint into its txid and output index', () => {
		expect(parseOutpoint(`${'AB'.repeat(32)}:3`)).toEqual({txid: 'ab'.repeat(32), vout: 3});
	});

	it.each(['ab'.repeat(32), `${'ab'.repeat(31)}:0`, `${'ab'.repeat(32)}:-1`, `${'zz'.repeat(32)}:0`])('refuses %s', (outpoint) => {
		expect(parseOutpoint(outpoint)).toBeNull();
	});
});

describe('chainConfirmations', () => {
	it('counts the block a transaction is in and each block on top of it', () => {
		expect([chainConfirmations(100, 100), chainConfirmations(105, 100)]).toEqual([1, 6]);
	});
});

describe('isDepositCredited', () => {
	it('counts a deposit credited once the paid total reaches the one it brings the quote to, and one under the minimum never', () => {
		expect([4_999, 5_000].map((amount_paid) => isDepositCredited({paid_when_credited: 5_000}, amount_paid))).toEqual([false, true]);
		expect(isDepositCredited({paid_when_credited: null}, 10_000)).toBe(false);
	});
});
