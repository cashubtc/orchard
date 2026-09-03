/* Shared Dependencies */
import {OrchardMintMeltQuote, MeltQuoteState} from '@shared/generated.types';

export class MintMeltQuote implements OrchardMintMeltQuote {
	public id: string;
	public unit: string;
	public amount: number;
	public request: string;
	public fee_reserve: number;
	public state: MeltQuoteState;
	public payment_preimage: string | null;
	public request_lookup_id: string | null;
	public msat_to_pay: number | null;
	public created_time: number;
	public paid_time: number | null;
	public payment_method: string;

	constructor(mint_melt_quote: OrchardMintMeltQuote) {
		this.id = mint_melt_quote.id;
		this.unit = mint_melt_quote.unit;
		this.amount = mint_melt_quote.amount;
		this.request = mint_melt_quote.request;
		this.fee_reserve = mint_melt_quote.fee_reserve;
		this.state = mint_melt_quote.state;
		this.payment_preimage = mint_melt_quote.payment_preimage ?? null;
		this.request_lookup_id = mint_melt_quote.request_lookup_id ?? null;
		this.msat_to_pay = mint_melt_quote.msat_to_pay ?? null;
		this.created_time = mint_melt_quote.created_time;
		this.paid_time = mint_melt_quote.paid_time ?? null;
		this.payment_method = mint_melt_quote.payment_method;
	}
}
