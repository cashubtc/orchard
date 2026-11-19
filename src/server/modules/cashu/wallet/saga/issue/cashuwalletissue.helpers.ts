/* Vendor Dependencies */
import {Amount, MintQuoteState} from '@cashu/cashu-ts';
import {HDKey} from '@scure/bip32';
/* Local Dependencies */
import {MintQuoteProgress} from '../../cashuwallet.enums.js';
import type {CashuWalletMintQuoteResponse} from '../../cashuwallet.types.js';

/** What a mint quote has been paid and issued: its NUT-04 totals, or on mints that predate them its bolt11 state for an amount */
export const mintQuoteTotals = (quote: CashuWalletMintQuoteResponse, amount: number): {paid: Amount; issued: Amount} => {
	const legacy_paid = quote.state !== undefined && quote.state !== MintQuoteState.UNPAID;
	return {
		paid: quote.amount_paid ?? Amount.from(legacy_paid ? amount : 0),
		issued: quote.amount_issued ?? Amount.from(quote.state === MintQuoteState.ISSUED ? amount : 0),
	};
};

/** How far any method's mint quote has progressed for an amount, from NUT-04 paid/issued totals or the legacy bolt11 state */
export const assessMintQuote = (quote: CashuWalletMintQuoteResponse, amount: number, now: number): MintQuoteProgress => {
	const {paid, issued} = mintQuoteTotals(quote, amount);
	if (paid.greaterThanOrEqual(issued.add(amount))) return MintQuoteProgress.MINTABLE;
	if (!issued.isZero() && paid.lessThanOrEqual(issued)) return MintQuoteProgress.ISSUED;
	if (paid.greaterThan(issued)) return MintQuoteProgress.WAITING;
	const expiry = mintQuoteExpiry(quote);
	return expiry !== null && expiry <= now ? MintQuoteProgress.EXPIRED : MintQuoteProgress.WAITING;
};

/** When a mint quote expires, or null when it never does; cdk sends 0 for bolt11 quotes whose backend set none, which means the same */
export const mintQuoteExpiry = (quote: Pick<CashuWalletMintQuoteResponse, 'expiry'>): number | null => quote.expiry || null;

/** NUT-20 mint quote locking keypair (hex) for a counter, derived from the wallet seed */
export const deriveMintQuoteKey = (seed: Uint8Array, counter: number): {privkey: string; pubkey: string} => {
	const node = HDKey.fromMasterSeed(seed).derive(`m/129373'/20'/0'/0'/${counter}`);
	if (!node.privateKey || !node.publicKey) throw new Error(`No mint quote key at counter ${counter}`);
	return {privkey: Buffer.from(node.privateKey).toString('hex'), pubkey: Buffer.from(node.publicKey).toString('hex')};
};
