/* Vendor Dependencies */
import {Amount, type MeltQuoteBaseResponse, type MeltQuoteBolt11Response, type MintInfo, type Wallet} from '@cashu/cashu-ts';
/* Native Dependencies */
import {methodMaxAmount} from '#server/modules/cashu/wallet/helpers/cashuwalletmethod.helpers';
import {quoteExpiry} from '#server/modules/cashu/wallet/helpers/cashuwalletquote.helpers';
import type {CashuWalletMeltQuote, CashuWalletMeltQuoteReserve} from '#server/modules/cashu/wallet/cashuwallet.types';

const MSAT_PER_UNIT: Readonly<Record<string, number>> = {sat: 1000, msat: 1};

/** How a payment method pays out: its melt quote call and the reserves that quote holds; each method overrides only where it differs */
export abstract class CashuWalletMeltQuoteMethod {
	abstract readonly method: 'bolt11' | 'bolt12' | 'onchain';
	abstract readonly amount: 'required' | 'optional';

	/** The payout rules for a payment method, or null when the wallet can't pay by it */
	static find(method: string): CashuWalletMeltQuoteMethod | null {
		return Object.hasOwn(MELT_QUOTE_METHODS, method) ? MELT_QUOTE_METHODS[method as keyof typeof MELT_QUOTE_METHODS] : null;
	}

	/** Ask the mint what paying a request costs, for an amount in the wallet's unit when the request leaves it open */
	abstract quote(wallet: Wallet, request: string, amount: number | null): Promise<CashuWalletMeltQuote>;

	/** Whether an amount for the method can be given in the unit */
	public takesAmountIn(_unit: string): boolean {
		return true;
	}

	/** Most one payment by the method may be at this mint for the unit, when the mint sets a limit */
	public maxAmount(info: MintInfo, unit: string): number {
		return methodMaxAmount(info, 5, this.method, unit);
	}

	/** A melt quote as the wallet reads it, with the reserve for each way the mint offers to pay it */
	protected toQuote(quote: MeltQuoteBaseResponse, reserves: CashuWalletMeltQuoteReserve[]): CashuWalletMeltQuote {
		return {quote_id: quote.quote, amount: quote.amount.toNumber(), expiry: quoteExpiry(quote), reserves};
	}
}

/** Lightning invoices and offers: one fee reserve, and amounts the mint takes in msat */
abstract class CashuWalletLightningMeltQuoteMethod extends CashuWalletMeltQuoteMethod {
	readonly amount = 'optional';

	/** The method's melt quote call */
	protected abstract create(wallet: Wallet, request: string, amount_msat?: number): Promise<MeltQuoteBolt11Response>;

	async quote(wallet: Wallet, request: string, amount: number | null): Promise<CashuWalletMeltQuote> {
		const quote = await this.create(wallet, request, amount === null ? undefined : this.toMsat(amount, wallet.unit));
		return this.toQuote(quote, [{fee_index: null, estimated_blocks: null, fee_reserve: quote.fee_reserve.toNumber()}]);
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

	protected create(wallet: Wallet, request: string, amount_msat?: number): Promise<MeltQuoteBolt11Response> {
		return wallet.createMeltQuoteBolt11(request, amount_msat);
	}
}

/** Lightning offers; an amount only for those that set none */
export class CashuWalletBolt12MeltQuoteMethod extends CashuWalletLightningMeltQuoteMethod {
	readonly method = 'bolt12';

	protected create(wallet: Wallet, request: string, amount_msat?: number): Promise<MeltQuoteBolt11Response> {
		return wallet.createMeltQuoteBolt12(request, amount_msat);
	}
}

/** Addresses, always for an amount; the mint offers a reserve per confirmation speed */
export class CashuWalletOnchainMeltQuoteMethod extends CashuWalletMeltQuoteMethod {
	readonly method = 'onchain';
	readonly amount = 'required';

	async quote(wallet: Wallet, request: string, amount: number | null): Promise<CashuWalletMeltQuote> {
		const quote = await wallet.createMeltQuoteOnchain(request, amount!);
		const reserves = quote.fee_options.map(({fee_index, estimated_blocks, fee_reserve}) => ({
			fee_index,
			estimated_blocks: Number.isInteger(estimated_blocks) ? estimated_blocks : null,
			fee_reserve: fee_reserve.toNumber(),
		}));
		return this.toQuote(quote, reserves);
	}
}

/** The payment methods a wallet pays out by; kept with the classes so nothing else can create them before they're defined */
const MELT_QUOTE_METHODS: Readonly<Record<'bolt11' | 'bolt12' | 'onchain', CashuWalletMeltQuoteMethod>> = {
	bolt11: new CashuWalletBolt11MeltQuoteMethod(),
	bolt12: new CashuWalletBolt12MeltQuoteMethod(),
	onchain: new CashuWalletOnchainMeltQuoteMethod(),
};
