/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {Amount, MintQuoteState, getPubKeyFromPrivKey, mnemonicToSeedSync} from '@cashu/cashu-ts';
/* Local Dependencies */
import {assessMintQuote, deriveQuoteKey, mintQuoteExpiry, mintQuoteTotals} from './cashuwalletissue.helpers.js';
import {MintQuoteProgress} from '../../cashuwallet.enums.js';

describe('mintQuoteTotals', () => {
	const base = {quote: 'q', request: 'r', unit: 'sat'};

	it.each([
		['NUT-04 totals as the mint reports them', {...base, amount_paid: Amount.from(80), amount_issued: Amount.from(30)}, [80, 30]],
		['a legacy bolt11 quote paid', {...base, state: MintQuoteState.PAID}, [100, 0]],
		['a legacy bolt11 quote issued', {...base, state: MintQuoteState.ISSUED}, [100, 100]],
		['a legacy bolt11 quote unpaid', {...base, state: MintQuoteState.UNPAID}, [0, 0]],
	])('reads %s', (_label, quote, [paid, issued]) => {
		const totals = mintQuoteTotals(quote, 100);
		expect([totals.paid.toNumber(), totals.issued.toNumber()]).toEqual([paid, issued]);
	});
});

describe('mintQuoteExpiry', () => {
	it.each([
		['an expiry as given', 1_000, 1_000],
		["cdk's 0 as none", 0, null],
		['a missing one as none', undefined, null],
	])('reads %s', (_label, expiry, expected) => {
		expect(mintQuoteExpiry({expiry})).toBe(expected);
	});
});

describe('assessMintQuote', () => {
	const base = {quote: 'q', request: 'r', unit: 'sat'};
	const totals = (paid: number, issued: number, expiry: number | null = null) => ({
		...base,
		amount_paid: Amount.from(paid),
		amount_issued: Amount.from(issued),
		expiry,
	});

	it.each([
		['bolt11 paid', {...base, state: MintQuoteState.PAID, expiry: 10}, MintQuoteProgress.MINTABLE],
		['bolt11 issued', {...base, state: MintQuoteState.ISSUED, expiry: 10}, MintQuoteProgress.ISSUED],
		['bolt11 unpaid', {...base, state: MintQuoteState.UNPAID, expiry: 200}, MintQuoteProgress.WAITING],
		['bolt11 unpaid and expired', {...base, state: MintQuoteState.UNPAID, expiry: 50}, MintQuoteProgress.EXPIRED],
		['bolt12 paid enough', totals(150, 50, 50), MintQuoteProgress.MINTABLE],
		['bolt12 partly paid, even when expired', totals(40, 0, 50), MintQuoteProgress.WAITING],
		['onchain fully issued', totals(100, 100), MintQuoteProgress.ISSUED],
		['bolt12 unpaid and expired', totals(0, 0, 50), MintQuoteProgress.EXPIRED],
		['unpaid with no expiry', totals(0, 0), MintQuoteProgress.WAITING],
		['bolt11 unpaid with expiry 0, meaning none', {...base, state: MintQuoteState.UNPAID, expiry: 0}, MintQuoteProgress.WAITING],
	])('%s', (_label, quote, progress) => {
		expect(assessMintQuote(quote, 100, 100)).toBe(progress);
	});
});

describe('deriveQuoteKey', () => {
	const seed = mnemonicToSeedSync('half depart obvious quality work element tank gorilla view sugar picture humble');

	it.each([
		[0, '03062837166e56114b59a4d1fd3a5a812bf7aadc1dde758428cf943d80acd41539'],
		[1, '02b47d9d41725f5ce6f08c874835cef25376cb1e95f6cb073fef52ca8fd986cf15'],
		[2, '029acbd3a46fd75bc05ba0226d0b4d909b2fb6e96c80544a094a1a3567737e44d3'],
		[3, '0373e4a42fbe0a4e18aadb57cf500b655f2446b4071ee579121d2ed8905bcc49c2'],
		[4, '02b8709bfce17c10f1864f5218844533ae60930d52089669b317d8b5f474eec071'],
	])('matches the NUT-20 test vector at counter %i', (counter, pubkey) => {
		const key = deriveQuoteKey(seed, counter);
		expect(key.pubkey).toBe(pubkey);
		expect(Buffer.from(getPubKeyFromPrivKey(Buffer.from(key.privkey, 'hex'))).toString('hex')).toBe(pubkey);
	});
});
