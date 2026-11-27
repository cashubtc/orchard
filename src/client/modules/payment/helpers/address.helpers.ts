/* Vendor Dependencies */
import {bech32, bech32m, createBase58check} from '@scure/base';
import {sha256} from '@noble/hashes/sha2.js';
/* Native Dependencies */
import {PAYMENT_SEGWIT_NETWORKS} from '@client/modules/payment/constants/payment.constants';
import type {PaymentNetwork, PaymentOnchain} from '@client/modules/payment/types/payment.types';

const BASE58CHECK = createBase58check(sha256);
const BASE58_BYTES = 21;
/** No base58check address runs longer; the decoder is quadratic, so longer strings aren't tried */
const BASE58_MAX_LENGTH = 35;
/** Version bytes of base58 P2PKH and P2SH addresses; testnet, signet and regtest share theirs */
const BASE58_VERSIONS: Record<number, PaymentNetwork[]> = {
	0x00: ['mainnet'],
	0x05: ['mainnet'],
	0x6f: ['testnet', 'signet', 'regtest'],
	0xc4: ['testnet', 'signet', 'regtest'],
};
const SILENT_PAYMENT_PREFIXES = ['sp', 'tsp'];
/** BIP352 addresses run past bech32's usual 90 characters */
const SILENT_PAYMENT_LIMIT = 1023;

/**
 * Reads an onchain address: base58 P2PKH or P2SH, or a segwit address of any version
 * @param {string} text - The address; segwit addresses in one case
 * @returns {PaymentOnchain | null} The address and the networks it can be for, or null when it isn't a valid one
 */
export function decodeAddress(text: string): PaymentOnchain | null {
	const address = readSegwit(text) ?? readBase58(text);
	return address && {kind: 'onchain', amount_msat: null, description: null, ...address};
}

/**
 * Whether a string is a BIP352 silent payment address
 * @param {string} text - The string to check
 * @returns {boolean} True for a valid `sp` or `tsp` address
 */
export function isSilentPayment(text: string): boolean {
	const decoded = bech32m.decodeUnsafe(text, SILENT_PAYMENT_LIMIT);
	return !!decoded && SILENT_PAYMENT_PREFIXES.includes(decoded.prefix);
}

/** A segwit address (BIP173, BIP350): version 0 in bech32, versions 1–16 in bech32m, with BIP141's program lengths */
function readSegwit(text: string): {request: string; networks: PaymentNetwork[]} | null {
	const version_0 = bech32.decodeUnsafe(text);
	const decoded = version_0 ?? bech32m.decodeUnsafe(text);
	const networks = decoded && PAYMENT_SEGWIT_NETWORKS.get(decoded.prefix);
	if (!decoded || !networks) return null;
	const [version, ...data] = decoded.words;
	const program = bech32.fromWordsUnsafe(data);
	if (!program || (version_0 ? version !== 0 : !(version >= 1 && version <= 16))) return null;
	const fits = version === 0 ? program.length === 20 || program.length === 32 : program.length >= 2 && program.length <= 40;
	return fits ? {request: text.toLowerCase(), networks} : null;
}

/** A base58check address with a known version byte */
function readBase58(text: string): {request: string; networks: PaymentNetwork[]} | null {
	if (text.length > BASE58_MAX_LENGTH) return null;
	try {
		const bytes = BASE58CHECK.decode(text);
		const networks = bytes.length === BASE58_BYTES ? BASE58_VERSIONS[bytes[0]] : undefined;
		return networks ? {request: text, networks} : null;
	} catch {
		return null;
	}
}
