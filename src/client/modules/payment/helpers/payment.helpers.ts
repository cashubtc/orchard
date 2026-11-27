/* Native Dependencies */
import type {PaymentOption} from '@client/modules/payment/types/payment.types';
/* Local Dependencies */
import {parseBip321} from './bip321.helpers';
import {readInstruction} from './instruction.helpers';

const WEB_LINK = /^https?:\/\//i;
/** LUD-01: a web link may carry an LNURL, or any Lightning string, in this parameter */
const LINK_PARAM = 'lightning';
/** Best reading first: offers, invoices, addresses, then formats only recognized */
const RANK: Record<PaymentOption['kind'], number> = {
	bolt12: 0,
	bolt11: 1,
	onchain: 2,
	payment_request: 3,
	lnurl: 4,
	bip353: 5,
	lightning_address: 6,
	bolt12_invoice: 7,
	silent_payment: 8,
	unsupported_bip321: 9,
};

/**
 * Every reading of a pasted or scanned string, best first.
 * Takes BIP321 URIs, `lightning:` strings, web links carrying a `lightning` parameter, and bare invoices, offers and addresses.
 * @param {string} input - What was pasted or scanned
 * @returns {PaymentOption[]} The readings; [] when it's none of these
 */
export function parsePayment(input: string): PaymentOption[] {
	const text = input.trim();
	const options = parseBip321(text) ?? readSingle(text);
	return options.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}

/** A single instruction, or the one a web link carries */
function readSingle(text: string): PaymentOption[] {
	const instruction = WEB_LINK.test(text) ? readLinkParam(text) : text;
	const option = instruction === null ? null : readInstruction(instruction);
	return option ? [option] : [];
}

/** The `lightning` parameter of a web link, or null when it has none */
function readLinkParam(text: string): string | null {
	try {
		return new URL(text).searchParams.get(LINK_PARAM);
	} catch {
		return null;
	}
}
