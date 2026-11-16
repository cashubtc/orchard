/* Vendor Dependencies */
import {Amount, type MintInfo, type Wallet} from '@cashu/cashu-ts';
/* Native Dependencies */
import type {CashuWalletQuote} from '#server/modules/cashu/wallet/quote/cashuwalletquote.entity';
import type {CashuWalletMintQuote} from '#server/modules/cashu/wallet/cashuwallet.types';

const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const NO_EXPIRY_WINDOW = 30 * DAY;

/** How a payment method receives: its quote call and the rules its quotes follow; each method overrides only where it differs */
export abstract class CashuWalletQuoteMethod {
	abstract readonly method: 'bolt11' | 'bolt12' | 'onchain';
	abstract readonly amount: 'required' | 'optional' | 'none';
	readonly reusable: boolean = true;
	protected readonly grace_seconds: number = HOUR;

	/** Ask the mint for a quote, locked to the pubkey when one is given */
	abstract create(wallet: Wallet, pubkey: string | null, amount: number | null, description?: string): Promise<CashuWalletMintQuote>;

	/** Whether its quotes are NUT-20 locked at this mint; the method requires it */
	public locks(_info: MintInfo): boolean {
		return true;
	}

	/** Whether the mint puts a description on its quotes for the unit */
	public describes(_info: MintInfo, _unit: string): boolean {
		return false;
	}

	/** Most one mint from its quotes may be at this mint for the unit, when the mint sets a limit */
	public maxAmount(info: MintInfo, unit: string): number {
		const setting = info.isSupported(4).params.find((entry) => entry.method === this.method && entry.unit === unit);
		return setting?.max_amount ? Amount.from(setting.max_amount).toNumber() : Infinity;
	}

	/** What's owed: everything paid and not yet minted */
	public mintable(quote: Pick<CashuWalletQuote, 'amount' | 'amount_paid'>, issued: number): number {
		return Math.max(0, quote.amount_paid - issued);
	}

	/** Whether a quote can take no more payments once this much is minted from it; a reusable one never is */
	public isComplete(_quote: Pick<CashuWalletQuote, 'amount'>, _issued: number): boolean {
		return false;
	}

	/** Until when a quote is checked for payments: its expiry, or 30 days from `since` when it has none, plus the method's grace */
	public checkUntil(expiry: number | null, since: number): number {
		return (expiry ?? since + NO_EXPIRY_WINDOW) + this.grace_seconds;
	}

	/** Whether a quote can be handed out again, reused or shown on the receive screen: it never expires or has more than an hour left */
	public canHandOut(quote: Pick<CashuWalletQuote, 'expiry' | 'amount_paid'>, now: number): boolean {
		return quote.expiry === null || quote.expiry - now > HOUR;
	}
}

/** One-off invoices for a fixed amount, minted in full once paid; NUT-20 locked when the mint supports it */
export class CashuWalletBolt11QuoteMethod extends CashuWalletQuoteMethod {
	readonly method = 'bolt11';
	readonly amount = 'required';
	readonly reusable = false;

	create(wallet: Wallet, pubkey: string | null, amount: number | null, description?: string): Promise<CashuWalletMintQuote> {
		return pubkey ? wallet.createLockedMintQuote(amount!, pubkey, description) : wallet.createMintQuoteBolt11(amount!, description);
	}

	/** When the mint supports NUT-20 */
	public locks(info: MintInfo): boolean {
		return info.isSupported(20).supported;
	}

	/** When the mint advertises descriptions for bolt11 in the unit */
	public describes(info: MintInfo, unit: string): boolean {
		return info.supportsNut04Description(this.method, unit);
	}

	/** Its amount once paid in full and not yet minted, else nothing */
	public mintable(quote: Pick<CashuWalletQuote, 'amount' | 'amount_paid'>, issued: number): number {
		return quote.amount !== null && quote.amount_paid >= quote.amount && issued < quote.amount ? quote.amount : 0;
	}

	/** Once its amount is minted */
	public isComplete(quote: Pick<CashuWalletQuote, 'amount'>, issued: number): boolean {
		return quote.amount !== null && issued >= quote.amount;
	}
}

/** Reusable offers for any amount or a fixed one; every payment is minted */
export class CashuWalletBolt12QuoteMethod extends CashuWalletQuoteMethod {
	readonly method = 'bolt12';
	readonly amount = 'optional';

	create(wallet: Wallet, pubkey: string | null, amount: number | null, description?: string): Promise<CashuWalletMintQuote> {
		return wallet.createMintQuoteBolt12(pubkey!, {amount: amount ?? undefined, description});
	}

	/** When the mint advertises descriptions for bolt12 in the unit */
	public describes(info: MintInfo, unit: string): boolean {
		return info.supportsNut04Description(this.method, unit);
	}
}

/** Reusable addresses; the mint keeps crediting deposits it saw before expiry while they confirm, and a paid address makes way for a fresh one */
export class CashuWalletOnchainQuoteMethod extends CashuWalletQuoteMethod {
	readonly method = 'onchain';
	readonly amount = 'none';
	protected readonly grace_seconds = 7 * DAY;

	create(wallet: Wallet, pubkey: string | null): Promise<CashuWalletMintQuote> {
		return wallet.createMintQuoteOnchain(pubkey!);
	}

	/** Only while nothing has been paid to it */
	public canHandOut(quote: Pick<CashuWalletQuote, 'expiry' | 'amount_paid'>, now: number): boolean {
		return quote.amount_paid === 0 && super.canHandOut(quote, now);
	}
}
