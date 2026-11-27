/* Vendor Dependencies */
import {bech32, hex} from '@scure/base';
/* Native Dependencies */
import {PAYMENT_UTF8} from '@client/modules/payment/constants/payment.constants';
import type {PaymentBolt12, PaymentNetwork} from '@client/modules/payment/types/payment.types';
/* Local Dependencies */
import {toSafeNumber} from './number.helpers';

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
/** A `+` and any whitespace after it, between two bech32 characters, so long strings can wrap */
const JOIN = new RegExp(`(?<=[${CHARSET}])\\+\\s*(?=[${CHARSET}])`, 'gi');
const OFFER_PREFIX = 'lno';
/** Invoices and invoice requests use the same encoding but aren't paid from a string */
const INVOICE_PREFIXES = ['lni', 'lnr'];
/** Chain hashes as offers carry them: the genesis block hash, byte-reversed */
const CHAINS: Record<string, PaymentNetwork> = {
	'6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000': 'mainnet',
	'43497fd7f826957108f4a30fd9cec3aeba79972084e90ead01ea330900000000': 'testnet',
	'43f08bdab050e35b567c864b91f47f50ae725ae2de53bcfbbaf284da00000000': 'testnet',
	f61eee3b63a380a477a063af32b2bbc97c9ff9f01f2c4225e973988108000000: 'signet',
	'06226e46111a0b59caaf126043eb5bbf28c34f3a5e332a1fc7b2b73cf188910f': 'regtest',
};
const TYPE = {chains: 2, currency: 6, amount: 8, description: 10, absolute_expiry: 14, paths: 16, issuer: 18, issuer_id: 22};
/** Offer fields a reader may meet; an unknown even type means the offer can't be read */
const KNOWN_TYPES = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
/** BigSize prefixes: the bytes that follow and the least value each may encode */
const BIG_SIZES: Record<number, [number, number]> = {0xfd: [2, 0xfd], 0xfe: [4, 0x1_0000], 0xff: [8, 0x1_0000_0000]};
const CHAIN_HASH_BYTES = 32;
const ISSUER_ID_BYTES = 33;
const TU64_BYTES = 8;

/**
 * Reads a BOLT 12 offer: its networks, amount, description, issuer and expiry.
 * Blinded paths, keys and feature bits are left to the payer.
 * @param {string} text - The offer, in one case, optionally wrapped with `+`
 * @returns {PaymentBolt12 | null} The offer, or null when the string isn't a valid one
 */
export function decodeOffer(text: string): PaymentBolt12 | null {
	try {
		const {prefix, request, bytes} = readString(text);
		return prefix === OFFER_PREFIX ? readOffer(request, readTlvs(bytes)) : null;
	} catch {
		return null;
	}
}

/**
 * Whether a string is a BOLT 12 invoice or invoice request, which a payer gets in reply to an offer
 * @param {string} text - The string to check
 * @returns {boolean} True for an `lni` or `lnr` string
 */
export function isBolt12Invoice(text: string): boolean {
	try {
		return INVOICE_PREFIXES.includes(readString(text).prefix);
	} catch {
		return false;
	}
}

/** The prefix and data of a BOLT 12 string: bech32 characters with no checksum, `+` joins removed */
function readString(text: string): {prefix: string; request: string; bytes: Uint8Array} {
	const joined = text.replace(JOIN, '');
	const request = joined.toLowerCase();
	if (joined !== request && joined !== joined.toUpperCase()) throw new Error('Mixed case');
	const separator = request.lastIndexOf('1');
	const words = [...request.slice(separator + 1)].map((char) => CHARSET.indexOf(char));
	if (separator < 1 || words.includes(-1)) throw new Error('Not a BOLT 12 string');
	return {prefix: request.slice(0, separator), request, bytes: bech32.fromWords(words)};
}

/** The TLV stream by type: ascending types inside the offer ranges, each with a length that fits */
function readTlvs(bytes: Uint8Array): Map<number, Uint8Array> {
	const fields = new Map<number, Uint8Array>();
	let offset = 0;
	let last = 0;
	while (offset < bytes.length) {
		const [type, length_offset] = readBigSize(bytes, offset);
		const [length, start] = readBigSize(bytes, length_offset);
		if (type <= last || !isOfferType(type) || start + length > bytes.length) throw new Error('Malformed offer');
		fields.set(type, bytes.subarray(start, start + length));
		offset = start + length;
		last = type;
	}
	return fields;
}

/** Whether a type may appear in an offer: 1–79 or the experimental range, and either known or odd */
function isOfferType(type: number): boolean {
	const in_range = (type >= 1 && type <= 79) || (type >= 1_000_000_000 && type <= 1_999_999_999);
	return in_range && (type % 2 === 1 || KNOWN_TYPES.has(type));
}

/** A BigSize integer and the offset after it, refusing one that isn't minimally encoded */
function readBigSize(bytes: Uint8Array, offset: number): [number, number] {
	const first = bytes[offset];
	if (first === undefined) throw new Error('Truncated');
	if (first < 0xfd) return [first, offset + 1];
	const [size, minimum] = BIG_SIZES[first];
	const value_bytes = bytes.subarray(offset + 1, offset + 1 + size);
	if (value_bytes.length !== size) throw new Error('Truncated');
	const value = readUint(value_bytes);
	if (value < minimum) throw new Error('BigSize not minimally encoded');
	return [value, offset + 1 + size];
}

/** The offer's fields, holding it to BOLT 12's reader rules */
function readOffer(request: string, fields: Map<number, Uint8Array>): PaymentBolt12 {
	const amount = readTu64(fields.get(TYPE.amount));
	const code = readText(fields.get(TYPE.currency));
	const description = readText(fields.get(TYPE.description));
	const issuer_id = fields.get(TYPE.issuer_id);
	if (amount === 0 || (amount !== null && description === null) || (code !== null && amount === null)) {
		throw new Error('Offer amount without a description, or currency without an amount');
	}
	if (issuer_id ? issuer_id.length !== ISSUER_ID_BYTES : !fields.has(TYPE.paths)) throw new Error('Offer has no issuer to reach');
	return {
		kind: 'bolt12',
		request,
		amount_msat: code === null ? amount : null,
		currency: code === null || amount === null ? null : {code, amount},
		description,
		issuer: readText(fields.get(TYPE.issuer)),
		expires_at: readTu64(fields.get(TYPE.absolute_expiry)),
		networks: readChains(fields.get(TYPE.chains)),
	};
}

/** The networks an offer is for, Bitcoin when it names none; chains this reader doesn't know are dropped */
function readChains(bytes: Uint8Array | undefined): PaymentNetwork[] {
	if (!bytes) return ['mainnet'];
	if (bytes.length === 0 || bytes.length % CHAIN_HASH_BYTES !== 0) throw new Error('Bad offer_chains');
	const networks = Array.from({length: bytes.length / CHAIN_HASH_BYTES}, (_, index) => {
		const start = index * CHAIN_HASH_BYTES;
		return CHAINS[hex.encode(bytes.subarray(start, start + CHAIN_HASH_BYTES))];
	});
	return [...new Set(networks.filter((network) => network !== undefined))];
}

/** A UTF-8 field, or null when absent */
function readText(bytes: Uint8Array | undefined): string | null {
	return bytes ? PAYMENT_UTF8.decode(bytes) : null;
}

/** A truncated u64 field: big-endian, at most 8 bytes, no leading zero byte; null when absent */
function readTu64(bytes: Uint8Array | undefined): number | null {
	if (!bytes) return null;
	if (bytes[0] === 0 || bytes.length > TU64_BYTES) throw new Error('Not a tu64');
	return readUint(bytes);
}

/** A big-endian unsigned integer */
function readUint(bytes: Uint8Array): number {
	return toSafeNumber(bytes.reduce((value, byte) => value * 256n + BigInt(byte), 0n));
}
