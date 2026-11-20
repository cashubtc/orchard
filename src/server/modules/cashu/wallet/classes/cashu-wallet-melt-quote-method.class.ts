/* Vendor Dependencies */
import {
	Amount,
	type CompleteMeltOptions,
	type MeltQuoteBolt11Response,
	type MeltQuoteOnchainResponse,
	type MintInfo,
	type Wallet,
} from '@cashu/cashu-ts';
/* Native Dependencies */
import {walletError} from '#server/modules/cashu/wallet/helpers/cashuwalleterror.helpers';
import {methodMaxAmount} from '#server/modules/cashu/wallet/helpers/cashuwalletmethod.helpers';
import {quoteExpiry} from '#server/modules/cashu/wallet/helpers/cashuwalletquote.helpers';
import type {
	CashuWalletMeltQuote,
	CashuWalletMeltQuoteReserve,
	CashuWalletMeltQuoteResponse,
} from '#server/modules/cashu/wallet/cashuwallet.types';

const MSAT_PER_UNIT: Readonly<Record<string, number>> = {sat: 1000, msat: 1};

/** How a payment method pays out: its melt quote calls, the reserves a quote holds, the proof it was paid, the NUT-17 subscription that watches it (none: polled) and whether its payments confirm onchain; each method overrides only where it differs */
export abstract class CashuWalletMeltQuoteMethod<TQuote extends CashuWalletMeltQuoteResponse = CashuWalletMeltQuoteResponse> {
	abstract readonly method: 'bolt11' | 'bolt12' | 'onchain';
	abstract readonly amount: 'required' | 'optional';
	readonly socket_kind: 'bolt11_melt_quote' | null = null;
	readonly tracks_chain: boolean = false;

	/** The payout rules for a payment method, or null when the wallet can't pay by it */
	static find(method: string): CashuWalletMeltQuoteMethod | null {
		return Object.hasOwn(MELT_QUOTE_METHODS, method) ? MELT_QUOTE_METHODS[method as keyof typeof MELT_QUOTE_METHODS] : null;
	}

	/** The method's melt quote call, for an amount in the wallet's unit when the request leaves it open */
	protected abstract create(wallet: Wallet, request: string, amount: number | null): Promise<TQuote>;

	/** The mint's current view of a melt quote */
	public check(wallet: Wallet, quote_id: string): Promise<TQuote> {
		return wallet.checkMeltQuote<TQuote>(this.method, quote_id);
	}

	/** What the mint holds back to pay a quote, one entry per way it offers to pay */
	abstract reserves(quote: TQuote): CashuWalletMeltQuoteReserve[];

	/** What shows the mint paid a quote, once it has: a preimage or an outpoint */
	abstract paymentProof(quote: TQuote): string | null;

	/** Ask the mint what paying a request costs */
	async quote(wallet: Wallet, request: string, amount: number | null): Promise<CashuWalletMeltQuote> {
		const quote = await this.create(wallet, request, amount);
		return {quote_id: quote.quote, amount: quote.amount.toNumber(), expiry: quoteExpiry(quote), reserves: this.reserves(quote)};
	}

	/** The reserve for the way chosen to pay a quote: Lightning's one takes no fee_index, each onchain speed has its own */
	public reserve(quote: TQuote, fee_index: number | null): number {
		const way = this.reserves(quote).find((reserve) => reserve.fee_index === fee_index);
		if (!way) throw walletError(fee_index === null ? `Pick a speed for ${this.method}` : `No speed ${fee_index} for this melt quote`);
		return way.fee_reserve;
	}

	/** How the wallet asks the mint to pay: without holding the request open on the payment, where the mint allows */
	public meltOptions(_fee_index: number | null): CompleteMeltOptions {
		return {preferAsync: true};
	}

	/** Whether an amount for the method can be given in the unit */
	public takesAmountIn(_unit: string): boolean {
		return true;
	}

	/** Most one payment by the method may be at this mint for the unit, when the mint sets a limit */
	public maxAmount(info: MintInfo, unit: string): number {
		return methodMaxAmount(info, 5, this.method, unit);
	}
}

/** Lightning invoices and offers: one fee reserve, a preimage once paid, and amounts the mint takes in msat */
abstract class CashuWalletLightningMeltQuoteMethod extends CashuWalletMeltQuoteMethod<MeltQuoteBolt11Response> {
	readonly amount = 'optional';

	/** The method's melt quote call, for an amount in msat */
	protected abstract createInMsat(wallet: Wallet, request: string, amount_msat?: number): Promise<MeltQuoteBolt11Response>;

	protected create(wallet: Wallet, request: string, amount: number | null): Promise<MeltQuoteBolt11Response> {
		return this.createInMsat(wallet, request, amount === null ? undefined : this.toMsat(amount, wallet.unit));
	}

	reserves(quote: MeltQuoteBolt11Response): CashuWalletMeltQuoteReserve[] {
		return [{fee_index: null, estimated_blocks: null, fee_reserve: quote.fee_reserve.toNumber()}];
	}

	paymentProof(quote: MeltQuoteBolt11Response): string | null {
		return quote.payment_preimage ?? null;
	}

	/** Only in sat or msat, which convert to the msat the mint takes */
	public takesAmountIn(unit: string): boolean {
		return Object.hasOwn(MSAT_PER_UNIT, unit);
	}

	/** An amount in the wallet's unit as msat, checked as an amount in that unit first */
	private toMsat(amount: number, unit: string): number {
		return Amount.from(amount).toNumber() * MSAT_PER_UNIT[unit];
	}
}

/** Lightning invoices; an amount only for those that set none */
export class CashuWalletBolt11MeltQuoteMethod extends CashuWalletLightningMeltQuoteMethod {
	readonly method = 'bolt11';
	readonly socket_kind = 'bolt11_melt_quote';

	protected createInMsat(wallet: Wallet, request: string, amount_msat?: number): Promise<MeltQuoteBolt11Response> {
		return wallet.createMeltQuoteBolt11(request, amount_msat);
	}

	/** cashu-ts's own call, which also checks the quote's amount against the invoice's */
	public check(wallet: Wallet, quote_id: string): Promise<MeltQuoteBolt11Response> {
		return wallet.checkMeltQuoteBolt11(quote_id);
	}
}

/** Lightning offers; an amount only for those that set none */
export class CashuWalletBolt12MeltQuoteMethod extends CashuWalletLightningMeltQuoteMethod {
	readonly method = 'bolt12';

	protected createInMsat(wallet: Wallet, request: string, amount_msat?: number): Promise<MeltQuoteBolt11Response> {
		return wallet.createMeltQuoteBolt12(request, amount_msat);
	}
}

/** Addresses, always for an amount; the mint offers a reserve per confirmation speed and pays to an outpoint */
export class CashuWalletOnchainMeltQuoteMethod extends CashuWalletMeltQuoteMethod<MeltQuoteOnchainResponse> {
	readonly method = 'onchain';
	readonly amount = 'required';
	readonly tracks_chain = true;

	protected create(wallet: Wallet, request: string, amount: number | null): Promise<MeltQuoteOnchainResponse> {
		return wallet.createMeltQuoteOnchain(request, amount!);
	}

	reserves(quote: MeltQuoteOnchainResponse): CashuWalletMeltQuoteReserve[] {
		return quote.fee_options.map(({fee_index, estimated_blocks, fee_reserve}) => ({
			fee_index,
			estimated_blocks: Number.isInteger(estimated_blocks) ? estimated_blocks : null,
			fee_reserve: fee_reserve.toNumber(),
		}));
	}

	paymentProof(quote: MeltQuoteOnchainResponse): string | null {
		return quote.outpoint ?? null;
	}

	/** The chosen speed goes with the melt */
	public meltOptions(fee_index: number | null): CompleteMeltOptions {
		return {...super.meltOptions(fee_index), extraPayload: {fee_index}};
	}
}

/** The payment methods a wallet pays out by; kept with the classes so nothing else can create them before they're defined */
const MELT_QUOTE_METHODS: Readonly<Record<'bolt11' | 'bolt12' | 'onchain', CashuWalletMeltQuoteMethod>> = {
	bolt11: new CashuWalletBolt11MeltQuoteMethod(),
	bolt12: new CashuWalletBolt12MeltQuoteMethod(),
	onchain: new CashuWalletOnchainMeltQuoteMethod(),
};
