/* Native Dependencies */
import {PAYMENT_SEGWIT_NETWORKS} from '@client/modules/payment/constants/payment.constants';
import type {PaymentOption} from '@client/modules/payment/types/payment.types';
/* Local Dependencies */
import {decodeAddress} from './address.helpers';
import {readInstruction} from './instruction.helpers';
import {toSafeNumber} from './number.helpers';

const SCHEME = /^bitcoin:(?:\/\/)?/i;
/** Decimal BTC with at most 8 decimals, the only amount form BIP321 allows */
const AMOUNT = /^(\d*)(?:\.(\d{0,8}))?$/;
const BTC_DECIMALS = 8;
const MSAT_PER_SAT = 1000n;
const REQUIRED_PREFIX = 'req-';
/** The kinds each instruction key may carry */
const INSTRUCTION_KINDS: ReadonlyMap<string, PaymentOption['kind'][]> = new Map([
	['lightning', ['bolt11', 'lnurl']],
	['lno', ['bolt12']],
	['sp', ['silent_payment']],
	['creq', ['payment_request']],
]);
/** Keys read here; a required key outside them makes the whole URI unusable */
const KNOWN_KEYS = new Set(['amount', 'label', 'message', ...INSTRUCTION_KINDS.keys(), ...PAYMENT_SEGWIT_NETWORKS.keys()]);

/**
 * Reads a BIP321 `bitcoin:` URI into the options it carries, in the order they appear.
 * Its amount, message and label apply to onchain options only, since invoices and offers carry their own.
 * @param {string} text - The URI; the scheme and keys in any case
 * @returns {PaymentOption[] | null} The options; one `unsupported_bip321` when it requires a key this reader doesn't read; [] when it isn't valid; null when it isn't a `bitcoin:` URI
 */
export function parseBip321(text: string): PaymentOption[] | null {
	if (!SCHEME.test(text)) return null;
	try {
		return readUri(text);
	} catch {
		return [];
	}
}

/** The URI's options, throwing on bad encoding or a bad amount */
function readUri(text: string): PaymentOption[] {
	const [body] = text.replace(SCHEME, '').split('#');
	const [path, query = ''] = splitOnce(body, '?');
	const params = query
		.split('&')
		.filter(Boolean)
		.map((pair) => splitOnce(pair, '='))
		.map(([key, value = '']) => [decodeURIComponent(key).toLowerCase(), decodeURIComponent(value)]);
	const unknown_required = params.some(([key]) => key.startsWith(REQUIRED_PREFIX) && !KNOWN_KEYS.has(key.slice(REQUIRED_PREFIX.length)));
	if (unknown_required) return [{kind: 'unsupported_bip321', request: text}];
	const values = params.map(([key, value]) => [key.startsWith(REQUIRED_PREFIX) ? key.slice(REQUIRED_PREFIX.length) : key, value]);
	const first = (key: string) => values.find(([name]) => name === key)?.[1] ?? null;
	const amount = first('amount');
	const amount_msat = amount === null ? null : readAmount(amount);
	const description = first('message') ?? first('label');
	return [path ? decodeAddress(decodeURIComponent(path)) : null, ...values.map(([key, value]) => readKey(key, value))]
		.filter((option) => option !== null)
		.map((option) => (option.kind === 'onchain' ? {...option, amount_msat, description} : option));
}

/** The option a query key carries, or null when it isn't an instruction or the reading doesn't fit the key */
function readKey(key: string, value: string): PaymentOption | null {
	const kinds = keyKinds(key, value);
	if (!kinds) return null;
	const option = readInstruction(value);
	return option && kinds.includes(option.kind) ? option : null;
}

/** The kinds a key may carry: its instruction's, or an address for a segwit prefix the value starts with */
function keyKinds(key: string, value: string): PaymentOption['kind'][] | undefined {
	if (!PAYMENT_SEGWIT_NETWORKS.has(key)) return INSTRUCTION_KINDS.get(key);
	return value.toLowerCase().startsWith(`${key}1`) ? ['onchain'] : undefined;
}

/** Decimal BTC as msat */
function readAmount(amount: string): number {
	const match = AMOUNT.exec(amount);
	if (!match || !/\d/.test(amount)) throw new Error('Not a BIP321 amount');
	const [, whole, fraction = ''] = match;
	return toSafeNumber(BigInt(whole + fraction.padEnd(BTC_DECIMALS, '0')) * MSAT_PER_SAT);
}

/** A string split at the first separator */
function splitOnce(text: string, separator: string): [string, string?] {
	const at = text.indexOf(separator);
	return at === -1 ? [text] : [text.slice(0, at), text.slice(at + 1)];
}
