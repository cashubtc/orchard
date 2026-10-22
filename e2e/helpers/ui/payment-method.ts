/**
 * Payment-method labels as Orchard renders them. Mirrors `CASHU_METHOD_DISPLAY`:
 * known methods get their label, anything else (e.g. fakewallet's `paypal`) shows in capitals.
 */

const METHOD_LABELS: Record<string, string> = {bolt11: 'BOLT 11', bolt12: 'BOLT 12', onchain: 'ONCHAIN'};

/** The label Orchard shows for a payment method */
export function methodLabel(method: string): string {
	return METHOD_LABELS[method] ?? method.toUpperCase();
}
