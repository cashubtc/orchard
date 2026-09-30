/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {Amount, MintQuoteState, getPubKeyFromPrivKey, mnemonicToSeedSync} from '@cashu/cashu-ts';
/* Local Dependencies */
import {assessMintQuote, deriveQuoteKey} from './cashuwalletissue.helpers.js';
import {MintQuoteProgress} from '../../cashuwallet.enums.js';

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
