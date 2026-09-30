/* Vendor Dependencies */
import {Amount, MintQuoteState} from '@cashu/cashu-ts';
import {HDKey} from '@scure/bip32';
/* Local Dependencies */
import {MintQuoteProgress} from '../../cashuwallet.enums.js';
import type {CashuWalletMintQuote} from '../../cashuwallet.types.js';

/** How far any method's mint quote has progressed for an amount, from NUT-04 paid/issued totals or the legacy bolt11 state */
export const assessMintQuote = (quote: CashuWalletMintQuote, amount: number, now: number): MintQuoteProgress => {
	const legacy_paid = quote.state !== undefined && quote.state !== MintQuoteState.UNPAID;
	const paid = quote.amount_paid ?? Amount.from(legacy_paid ? amount : 0);
	const issued = quote.amount_issued ?? Amount.from(quote.state === MintQuoteState.ISSUED ? amount : 0);
	if (paid.greaterThanOrEqual(issued.add(amount))) return MintQuoteProgress.MINTABLE;
	if (!issued.isZero() && paid.lessThanOrEqual(issued)) return MintQuoteProgress.ISSUED;
	if (paid.greaterThan(issued)) return MintQuoteProgress.WAITING;
	return quote.expiry != null && quote.expiry <= now ? MintQuoteProgress.EXPIRED : MintQuoteProgress.WAITING;
};

/** NUT-20 quote locking keypair (hex) for a counter, derived from the wallet seed */
export const deriveQuoteKey = (seed: Uint8Array, counter: number): {privkey: string; pubkey: string} => {
	const node = HDKey.fromMasterSeed(seed).derive(`m/129373'/20'/0'/0'/${counter}`);
	if (!node.privateKey || !node.publicKey) throw new Error(`No quote key at counter ${counter}`);
	return {privkey: Buffer.from(node.privateKey).toString('hex'), pubkey: Buffer.from(node.publicKey).toString('hex')};
};
