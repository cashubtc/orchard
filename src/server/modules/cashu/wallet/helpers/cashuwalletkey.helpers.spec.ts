/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {getPubKeyFromPrivKey, mnemonicToSeedSync} from '@cashu/cashu-ts';
/* Local Dependencies */
import {deriveMintQuoteKey, getCounterKey} from './cashuwalletkey.helpers.js';

describe('getCounterKey', () => {
	it('gives version 00 ids that derive alike one cursor', () => {
		expect(getCounterKey('0000000000000001')).toBe(getCounterKey('0000000080000000'));
		expect(getCounterKey('0000000000000001')).not.toBe(getCounterKey('0000000000000002'));
	});

	it('keeps a version 01 id whole, since its secrets derive from all of it', () => {
		const id = `01${'0'.repeat(63)}1`;
		expect(getCounterKey(id)).toBe(id);
	});
});

describe('deriveMintQuoteKey', () => {
	const seed = mnemonicToSeedSync('half depart obvious quality work element tank gorilla view sugar picture humble');

	it.each([
		[0, '03062837166e56114b59a4d1fd3a5a812bf7aadc1dde758428cf943d80acd41539'],
		[1, '02b47d9d41725f5ce6f08c874835cef25376cb1e95f6cb073fef52ca8fd986cf15'],
		[2, '029acbd3a46fd75bc05ba0226d0b4d909b2fb6e96c80544a094a1a3567737e44d3'],
		[3, '0373e4a42fbe0a4e18aadb57cf500b655f2446b4071ee579121d2ed8905bcc49c2'],
		[4, '02b8709bfce17c10f1864f5218844533ae60930d52089669b317d8b5f474eec071'],
	])('matches the NUT-20 test vector at counter %i', (counter, pubkey) => {
		const key = deriveMintQuoteKey(seed, counter);
		expect(key.pubkey).toBe(pubkey);
		expect(Buffer.from(getPubKeyFromPrivKey(Buffer.from(key.privkey, 'hex'))).toString('hex')).toBe(pubkey);
	});
});
