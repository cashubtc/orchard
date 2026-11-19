/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import type {MintInfo} from '@cashu/cashu-ts';
/* Local Dependencies */
import {methodMaxAmount} from './cashuwalletmethod.helpers.js';

describe('methodMaxAmount', () => {
	const params = [
		{method: 'onchain', unit: 'sat', max_amount: 600},
		{method: 'bolt12', unit: 'sat', max_amount: null},
	];
	const info = {isSupported: jest.fn(() => ({params}))} as unknown as MintInfo;

	it("reads the method's max_amount for the unit from the NUT asked for", () => {
		expect(methodMaxAmount(info, 5, 'onchain', 'sat')).toBe(600);
		expect(info.isSupported).toHaveBeenCalledWith(5);
	});

	it('sets no limit when the mint sets none or lists no such method and unit', () => {
		expect([methodMaxAmount(info, 4, 'bolt12', 'sat'), methodMaxAmount(info, 4, 'onchain', 'usd')]).toEqual([Infinity, Infinity]);
	});
});
