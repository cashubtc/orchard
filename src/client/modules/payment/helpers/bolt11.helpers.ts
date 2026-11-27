/* Vendor Dependencies */
import {bech32} from '@scure/base';
/* Native Dependencies */
import {PAYMENT_UTF8} from '@client/modules/payment/constants/payment.constants';
import type {PaymentBolt11, PaymentNetwork} from '@client/modules/payment/types/payment.types';
/* Local Dependencies */
import {toSafeNumber} from './number.helpers';

/** `ln`, the network's currency, then an optional amount and multiplier */
const PREFIX = /^ln(bcrt|tbs|bc|tb)(?:(\d+)([munp]?))?$/;
const NETWORKS: Record<string, PaymentNetwork> = {bc: 'mainnet', tb: 'testnet', tbs: 'signet', bcrt: 'regtest'};
/** Pico-bitcoin per unit of each multiplier */
const PICO_BTC: Record<string, bigint> = {'': 1_000_000_000_000n, m: 1_000_000_000n, u: 1_000_000n, n: 1_000n, p: 1n};
const PICO_BTC_PER_MSAT = 10n;
const TIMESTAMP_WORDS = 7;
const SIGNATURE_WORDS = 104;
const MAX_EXPIRY_WORDS = 10;
const DEFAULT_EXPIRY = 3600;
const TAG = {payment_hash: 1, expiry: 6, description: 13, payment_secret: 16, payee: 19, description_hash: 23};
/** Fields whose data length is fixed; any other length fails the invoice */
const FIXED_LENGTHS = new Map([
	[TAG.payment_hash, 52],
	[TAG.payment_secret, 52],
	[TAG.description_hash, 52],
	[TAG.payee, 53],
]);

/**
 * Reads a BOLT 11 invoice: its network, amount, description and expiry.
 * The signature, feature bits and routing hints are left to the payer.
 * @param {string} text - The invoice, in one case
 * @returns {PaymentBolt11 | null} The invoice, or null when the string isn't a valid one
 */
export function decodeBolt11(text: string): PaymentBolt11 | null {
	try {
		return readInvoice(text);
	} catch {
		return null;
	}
}

/** The invoice, throwing on anything BOLT 11 tells a reader to fail */
function readInvoice(text: string): PaymentBolt11 {
	const {prefix, words} = bech32.decode(text, false);
	const [, currency, digits, multiplier] = PREFIX.exec(prefix) ?? [];
	if (!currency || words.length < TIMESTAMP_WORDS + SIGNATURE_WORDS) throw new Error('Not an invoice');
	const fields = readFields(words.slice(TIMESTAMP_WORDS, -SIGNATURE_WORDS));
	const created_at = toNumber(words.slice(0, TIMESTAMP_WORDS));
	return {
		kind: 'bolt11',
		request: text.toLowerCase(),
		amount_msat: digits ? readAmount(digits, multiplier) : null,
		description: readDescription(fields),
		created_at,
		expires_at: created_at + readExpiry(fields),
		networks: [NETWORKS[currency]],
	};
}

/** The amount in msat; a pico-bitcoin amount must come to whole msat */
function readAmount(digits: string, multiplier: string): number {
	const pico_btc = BigInt(digits) * PICO_BTC[multiplier];
	if (pico_btc % PICO_BTC_PER_MSAT !== 0n) throw new Error('Sub-millisatoshi amount');
	return toSafeNumber(pico_btc / PICO_BTC_PER_MSAT);
}

/** Tagged fields by type, each a list of its occurrences in 5-bit words; exactly one payment hash and one payment secret */
function readFields(words: number[]): Map<number, number[][]> {
	const fields = new Map<number, number[][]>();
	for (let offset = 0; offset < words.length;) {
		const [type, high, low] = words.slice(offset, offset + 3);
		const length = high * 32 + low;
		const data = words.slice(offset + 3, offset + 3 + length);
		if (data.length !== length || (FIXED_LENGTHS.get(type) ?? length) !== length) throw new Error('Field of the wrong length');
		if (!fields.has(type)) fields.set(type, []);
		fields.get(type)!.push(data);
		offset += 3 + length;
	}
	if (fields.get(TAG.payment_hash)?.length !== 1 || fields.get(TAG.payment_secret)?.length !== 1) {
		throw new Error('Needs one payment hash and one payment secret');
	}
	return fields;
}

/** The description, or null when only its hash is given; an invoice has exactly one of the two */
function readDescription(fields: Map<number, number[][]>): string | null {
	const descriptions = fields.get(TAG.description) ?? [];
	const hashes = fields.get(TAG.description_hash) ?? [];
	if (descriptions.length + hashes.length !== 1) throw new Error('Needs one description or description hash');
	return descriptions.length ? PAYMENT_UTF8.decode(bech32.fromWords(descriptions[0])) : null;
}

/** Seconds the invoice stays payable after its timestamp */
function readExpiry(fields: Map<number, number[][]>): number {
	const [expiry] = fields.get(TAG.expiry) ?? [];
	if (!expiry) return DEFAULT_EXPIRY;
	if (expiry[0] === 0 || expiry.length > MAX_EXPIRY_WORDS) throw new Error('Expiry not minimally encoded');
	return toNumber(expiry);
}

/** Big-endian 5-bit words as a number */
function toNumber(words: number[]): number {
	return words.reduce((value, word) => value * 32 + word, 0);
}
