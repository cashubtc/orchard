/* Vendor Dependencies */
import {bech32} from '@scure/base';
/* Native Dependencies */
import {PAYMENT_UTF8} from '@client/modules/payment/constants/payment.constants';

const LNURL_PREFIX = 'lnurl';
/** LUD-17 schemes, which stand in for https (or http for an onion) */
const LNURL_SCHEMES = ['lnurlp:', 'lnurlw:', 'lnurlc:', 'keyauth:'];
/** LUD-16: a username of a-z0-9-_. (+ for tags) at a dotted domain; case is ignored, since people type capitals */
const LIGHTNING_ADDRESS = /^[a-z0-9\-_.+]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const BIP353_PREFIX = '₿';

/**
 * Whether a string is an LNURL: a LUD-01 bech32 LNURL holding an https URL (or http for an onion), or a LUD-17 link
 * @param {string} text - The string to check
 * @returns {boolean} True for an LNURL; it isn't fetched
 */
export function isLnurl(text: string): boolean {
	return isBech32Lnurl(text) || isLnurlLink(text);
}

/**
 * Whether a string is a LUD-16 Lightning address
 * @param {string} text - The string to check
 * @returns {boolean} True for `user@domain`; it isn't resolved
 */
export function isLightningAddress(text: string): boolean {
	return LIGHTNING_ADDRESS.test(text);
}

/**
 * Whether a string is a BIP353 name in its display form, `₿user@domain`
 * @param {string} text - The string to check
 * @returns {boolean} True for a `₿` name; it isn't resolved
 */
export function isBip353Name(text: string): boolean {
	return text.startsWith(BIP353_PREFIX) && LIGHTNING_ADDRESS.test(text.slice(BIP353_PREFIX.length));
}

/** A bech32 `lnurl` string whose URL is one LUD-01 allows */
function isBech32Lnurl(text: string): boolean {
	const decoded = bech32.decodeUnsafe(text, false);
	const bytes = decoded?.prefix === LNURL_PREFIX ? bech32.fromWordsUnsafe(decoded.words) : undefined;
	if (!bytes) return false;
	try {
		const url = new URL(PAYMENT_UTF8.decode(bytes));
		return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname.endsWith('.onion'));
	} catch {
		return false;
	}
}

/** A LUD-17 link with a host */
function isLnurlLink(text: string): boolean {
	try {
		const url = new URL(text);
		return LNURL_SCHEMES.includes(url.protocol) && url.hostname !== '';
	} catch {
		return false;
	}
}
