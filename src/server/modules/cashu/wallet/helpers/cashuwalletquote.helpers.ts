/* Vendor Dependencies */
import {Amount, MintQuoteState} from '@cashu/cashu-ts';
/* Native Dependencies */
import {MintQuoteProgress} from '#server/modules/cashu/wallet/cashuwallet.enums';
import type {CashuWalletMintQuoteResponse} from '#server/modules/cashu/wallet/cashuwallet.types';

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
	const expiry = quoteExpiry(quote);
	return expiry !== null && expiry <= now ? MintQuoteProgress.EXPIRED : MintQuoteProgress.WAITING;
};

/** When a mint or melt quote expires, or null when it never does; cdk sends 0 for a quote whose backend set none, which means the same */
export const quoteExpiry = (quote: {expiry?: number | null}): number | null => quote.expiry || null;
