/* Native Dependencies */
import type {PaymentOption, PaymentRecognizedKind} from '@client/modules/payment/types/payment.types';
/* Local Dependencies */
import {decodeAddress, isSilentPayment} from './address.helpers';
import {decodeBolt11} from './bolt11.helpers';
import {decodeOffer, isBolt12Invoice} from './bolt12.helpers';
import {isBip353Name, isLightningAddress, isLnurl} from './lnurl.helpers';
import {isPaymentRequest} from './payment-request.helpers';

const LIGHTNING_SCHEME = /^lightning:(?:\/\/)?/i;
/** Formats recognized by their shape, tried in order */
const RECOGNIZERS: [PaymentRecognizedKind, (text: string) => boolean][] = [
	['payment_request', isPaymentRequest],
	['lnurl', isLnurl],
	['bip353', isBip353Name],
	['lightning_address', isLightningAddress],
	['bolt12_invoice', isBolt12Invoice],
	['silent_payment', isSilentPayment],
];

/**
 * Reads one payment instruction: decoded in full when it can be, else recognized by its shape
 * @param {string} text - An invoice, offer, address or other instruction, optionally behind `lightning:`
 * @returns {PaymentOption | null} Its reading, or null when it's none of these
 */
export function readInstruction(text: string): PaymentOption | null {
	const bare = text.replace(LIGHTNING_SCHEME, '');
	const decoded = decodeBolt11(bare) ?? decodeOffer(bare) ?? decodeAddress(bare);
	if (decoded) return decoded;
	const recognized = RECOGNIZERS.find(([, recognizes]) => recognizes(bare));
	return recognized ? {kind: recognized[0], request: bare} : null;
}
