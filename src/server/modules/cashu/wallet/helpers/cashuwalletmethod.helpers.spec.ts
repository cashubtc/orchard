/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import type {MintInfo} from '@cashu/cashu-ts';
/* Local Dependencies */
import {methodMaxAmount, methodMinAmount, methodSetting} from './cashuwalletmethod.helpers.js';

const params = [
	{method: 'onchain', unit: 'sat', min_amount: 1000, max_amount: 600, options: {confirmations: 6}},
	{method: 'bolt12', unit: 'sat', min_amount: null, max_amount: null},
];
const info = {isSupported: jest.fn(() => ({params}))} as unknown as MintInfo;

describe('methodSetting', () => {
	it("finds the method's settings for the unit in the NUT asked for, or nothing", () => {
		expect(methodSetting(info, 4, 'onchain', 'sat')?.options?.confirmations).toBe(6);
		expect(info.isSupported).toHaveBeenCalledWith(4);
		expect(methodSetting(info, 4, 'onchain', 'usd')).toBeUndefined();
	});
});

describe('methodMaxAmount', () => {
	it("reads the method's max_amount for the unit from the NUT asked for", () => {
		expect(methodMaxAmount(info, 5, 'onchain', 'sat')).toBe(600);
		expect(info.isSupported).toHaveBeenCalledWith(5);
	});

	it('sets no limit when the mint sets none or lists no such method and unit', () => {
		expect([methodMaxAmount(info, 4, 'bolt12', 'sat'), methodMaxAmount(info, 4, 'onchain', 'usd')]).toEqual([Infinity, Infinity]);
	});
});

describe('methodMinAmount', () => {
	it("reads the method's min_amount for the unit, 0 when the mint sets none or lists no such method and unit", () => {
		const amounts = [
			methodMinAmount(info, 4, 'onchain', 'sat'),
			methodMinAmount(info, 4, 'bolt12', 'sat'),
			methodMinAmount(info, 4, 'onchain', 'usd'),
		];
		expect(amounts).toEqual([1000, 0, 0]);
	});
});
