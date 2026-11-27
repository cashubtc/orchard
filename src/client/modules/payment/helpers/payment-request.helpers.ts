/* Vendor Dependencies */
import {bech32m} from '@scure/base';

/** NUT-18: `creqA` then base64url CBOR */
const CREQ_A = /^creqA[A-Za-z0-9_-]+={0,2}$/;
/** NUT-26: bech32m with this prefix, often upper case for QR codes */
const CREQ_B_PREFIX = 'creqb';

/**
 * Whether a string is a Cashu payment request, in NUT-18 or NUT-26 form
 * @param {string} text - The string to check
 * @returns {boolean} True for a `creqA…` or `creqb1…` request; it isn't decoded
 */
export function isPaymentRequest(text: string): boolean {
	return CREQ_A.test(text) || bech32m.decodeUnsafe(text, false)?.prefix === CREQ_B_PREFIX;
}
