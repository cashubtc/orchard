/** A Bitcoin network a payment can be for; testnet covers testnet3 and testnet4 */
export type PaymentNetwork = 'mainnet' | 'testnet' | 'signet' | 'regtest';

/** A BOLT 11 invoice read from its string; its signature is never checked */
export type PaymentBolt11 = {
	kind: 'bolt11';
	request: string;
	amount_msat: number | null;
	description: string | null;
	created_at: number;
	expires_at: number;
	networks: PaymentNetwork[];
};

/** A BOLT 12 offer; amount_msat is null when the payer chooses, or when it's priced in a currency, whose minor units `currency` carries */
export type PaymentBolt12 = {
	kind: 'bolt12';
	request: string;
	amount_msat: number | null;
	currency: {code: string; amount: number} | null;
	description: string | null;
	issuer: string | null;
	expires_at: number | null;
	networks: PaymentNetwork[];
};

/** An onchain address; an amount and description only come with a BIP321 URI */
export type PaymentOnchain = {
	kind: 'onchain';
	request: string;
	amount_msat: number | null;
	description: string | null;
	networks: PaymentNetwork[];
};

/** A payment instruction read in full */
export type PaymentDecoded = PaymentBolt11 | PaymentBolt12 | PaymentOnchain;

/** Formats recognized by their shape, and BIP321 URIs requiring a key this reader doesn't read; nothing is read from them */
export type PaymentRecognizedKind =
	'payment_request' | 'lnurl' | 'lightning_address' | 'bip353' | 'bolt12_invoice' | 'silent_payment' | 'unsupported_bip321';

/** A recognized format, keeping the string as it was given */
export type PaymentRecognized = {
	kind: PaymentRecognizedKind;
	request: string;
};

/** One reading of a pasted or scanned string */
export type PaymentOption = PaymentDecoded | PaymentRecognized;
