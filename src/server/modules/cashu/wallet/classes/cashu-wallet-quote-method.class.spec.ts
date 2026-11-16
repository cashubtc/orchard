/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import type {MintInfo, Wallet} from '@cashu/cashu-ts';
/* Local Dependencies */
import {
	CashuWalletBolt11QuoteMethod,
	CashuWalletBolt12QuoteMethod,
	CashuWalletOnchainQuoteMethod,
} from './cashu-wallet-quote-method.class.js';

describe('CashuWalletQuoteMethod', () => {
	const HOUR = 60 * 60;
	const DAY = 24 * HOUR;
	const bolt11 = new CashuWalletBolt11QuoteMethod();
	const bolt12 = new CashuWalletBolt12QuoteMethod();
	const onchain = new CashuWalletOnchainQuoteMethod();

	it.each([
		['bolt11 once paid in full', bolt11, {amount: 100, amount_paid: 100}, 0, 100],
		['bolt11 before it is paid', bolt11, {amount: 100, amount_paid: 0}, 0, 0],
		['bolt11 already minted', bolt11, {amount: 100, amount_paid: 100}, 100, 0],
		['bolt12 paid since the last mint', bolt12, {amount: null, amount_paid: 80}, 30, 50],
		['onchain when the mint reports less than the wallet minted', onchain, {amount: null, amount_paid: 80}, 90, 0],
	])('mints %s', (_label, method, quote, issued, owed) => {
		expect(method.mintable(quote, issued)).toBe(owed);
	});

	it('takes no more on a bolt11 invoice once its amount is minted, and never stops a reusable quote', () => {
		expect(bolt11.isComplete({amount: 100}, 99)).toBe(false);
		expect(bolt11.isComplete({amount: 100}, 100)).toBe(true);
		expect(bolt12.isComplete({amount: 100}, 100)).toBe(false);
	});

	it.each([
		['bolt11 an hour past its expiry', bolt11, 1_000, 1_000 + HOUR],
		['onchain a week past its expiry, while deposits the mint saw confirm', onchain, 1_000, 1_000 + 7 * DAY],
		['a quote without expiry for 30 days and an hour', bolt12, null, 500 + 30 * DAY + HOUR],
	])('checks %s', (_label, method, expiry, until) => {
		expect(method.checkUntil(expiry, 500)).toBe(until);
	});

	it.each([
		['no expiry', null, true],
		['more than an hour left', 1_000 + HOUR + 1, true],
		['an hour or less left', 1_000 + HOUR, false],
	])('hands out a quote with %s', (_label, expiry, handed_out) => {
		expect(bolt12.canHandOut({expiry, amount_paid: 0}, 1_000)).toBe(handed_out);
	});

	it('keeps handing out a paid bolt12 offer, but makes way for a fresh address once an onchain one is paid', () => {
		expect(bolt12.canHandOut({expiry: null, amount_paid: 10}, 1_000)).toBe(true);
		expect(onchain.canHandOut({expiry: null, amount_paid: 10}, 1_000)).toBe(false);
	});

	it('describes bolt11 and bolt12 quotes only where the mint advertises it, and onchain addresses never', () => {
		const info = {supportsNut04Description: jest.fn((method: string) => method === 'bolt12')} as unknown as MintInfo;
		expect([bolt11, bolt12, onchain].map((method) => method.describes(info, 'sat'))).toEqual([false, true, false]);
		expect(info.supportsNut04Description).toHaveBeenCalledWith('bolt12', 'sat');
	});

	it("caps one mint at the method's max_amount for the unit, or not at all when the mint sets none", () => {
		const params = [
			{method: 'onchain', unit: 'sat', max_amount: 600},
			{method: 'bolt12', unit: 'sat', max_amount: null},
		];
		const info = {isSupported: () => ({params})} as unknown as MintInfo;
		expect([onchain.maxAmount(info, 'sat'), bolt12.maxAmount(info, 'sat'), onchain.maxAmount(info, 'usd')]).toEqual([
			600,
			Infinity,
			Infinity,
		]);
	});

	it('locks bolt11 invoices only at mints that support NUT-20, and bolt12 and onchain quotes always', () => {
		const info = (supported: boolean) => ({isSupported: () => ({supported})}) as unknown as MintInfo;
		expect([bolt11.locks(info(true)), bolt11.locks(info(false))]).toEqual([true, false]);
		expect([bolt12.locks(info(false)), onchain.locks(info(false))]).toEqual([true, true]);
	});

	it('locks a bolt11 invoice only when given a key, and always asks for bolt12 and onchain quotes with one', async () => {
		const wallet = {
			createMintQuoteBolt11: jest.fn(async () => ({quote: 'plain'})),
			createLockedMintQuote: jest.fn(async () => ({quote: 'locked'})),
			createMintQuoteBolt12: jest.fn(async () => ({quote: 'offer'})),
			createMintQuoteOnchain: jest.fn(async () => ({quote: 'address'})),
		} as unknown as Wallet;
		await bolt11.create(wallet, null, 100, 'Lunch');
		await bolt11.create(wallet, '02key', 100);
		await bolt12.create(wallet, '02key', null, 'Coffee');
		await onchain.create(wallet, '02key');
		expect(wallet.createMintQuoteBolt11).toHaveBeenCalledWith(100, 'Lunch');
		expect(wallet.createLockedMintQuote).toHaveBeenCalledWith(100, '02key', undefined);
		expect(wallet.createMintQuoteBolt12).toHaveBeenCalledWith('02key', {amount: undefined, description: 'Coffee'});
		expect(wallet.createMintQuoteOnchain).toHaveBeenCalledWith('02key');
	});
});
