/* Native Dependencies */
import type {PaymentNetwork} from '@client/modules/payment/types/payment.types';

/** Segwit address prefixes and their networks; BIP321 also uses them as keys for extra addresses */
export const PAYMENT_SEGWIT_NETWORKS: ReadonlyMap<string, PaymentNetwork[]> = new Map([
	['bc', ['mainnet']],
	['tb', ['testnet', 'signet']],
	['bcrt', ['regtest']],
]);

/** Strict UTF-8, as BOLT 11 and BOLT 12 require: invalid bytes throw instead of becoming U+FFFD */
export const PAYMENT_UTF8 = new TextDecoder('utf-8', {fatal: true});
