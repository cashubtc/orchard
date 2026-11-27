/* Local Dependencies */
import {isBip353Name, isLightningAddress, isLnurl} from './lnurl.helpers';

/* LUD-01's example, holding https://service.com/api?q=… */
const LNURL =
	'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS';
/* http://lnurlexample7fq3ooa.onion/pay and http://service.com/pay */
const ONION_LNURL = 'lnurl1dp68gup69uhkcmn4wfkx27rpd4cxcefhvecnxmm0vyhx7mnfdahz7urp0ye8vxkm';
const HTTP_LNURL = 'lnurl1dp68gup69uhhxetjwe5kxefwvdhk6tmsv9us85tvxr';

describe('LnurlHelpers', () => {
	describe('isLnurl', () => {
		it('recognizes a bech32 LNURL in either case', () => {
			expect(isLnurl(LNURL)).toBeTrue();
			expect(isLnurl(LNURL.toLowerCase())).toBeTrue();
		});

		it('allows plain http only for an onion', () => {
			expect(isLnurl(ONION_LNURL)).toBeTrue();
			expect(isLnurl(HTTP_LNURL)).toBeFalse();
		});

		it('recognizes LUD-17 links', () => {
			expect(isLnurl('lnurlp://service.com/pay')).toBeTrue();
			expect(isLnurl('lnurlw://service.com/withdraw?k1=abc')).toBeTrue();
			expect(isLnurl('keyauth://service.com/login')).toBeTrue();
			expect(isLnurl('https://service.com/pay')).toBeFalse();
		});

		it('refuses a corrupted LNURL', () => {
			expect(isLnurl(`${LNURL.slice(0, -1)}Q`)).toBeFalse();
		});
	});

	describe('isLightningAddress', () => {
		it('recognizes a LUD-16 address, tags included', () => {
			expect(isLightningAddress('satoshi@bitcoin.org')).toBeTrue();
			expect(isLightningAddress('Satoshi+tips@pay.bitcoin.org')).toBeTrue();
			expect(isLightningAddress('satoshi@localhost')).toBeFalse();
			expect(isLightningAddress('@bitcoin.org')).toBeFalse();
		});
	});

	describe('isBip353Name', () => {
		it('recognizes a name only in its ₿ display form', () => {
			expect(isBip353Name('₿satoshi@bitcoin.org')).toBeTrue();
			expect(isBip353Name('satoshi@bitcoin.org')).toBeFalse();
		});
	});
});
