/* Shared Dependencies */
import {OrchardMintMintQuote, MintQuoteState, MintUnit} from '@shared/generated.types';

export class MintMintQuote implements OrchardMintMintQuote {
	public id: string;
	public amount: number | null;
	public unit: MintUnit;
	public request: string;
	public state: MintQuoteState;
	public request_lookup_id: string | null;
	public pubkey: string | null;
	public issued_time: number | null;
	public created_time: number;
	public paid_time: number | null;
	public amount_paid: number;
	public amount_issued: number;
	public payment_method: string;

	constructor(mint_mint_quote: OrchardMintMintQuote) {
		this.id = mint_mint_quote.id;
		this.amount = mint_mint_quote.amount ?? null;
		this.unit = mint_mint_quote.unit;
		this.request = mint_mint_quote.request;
		this.state = mint_mint_quote.state;
		this.request_lookup_id = mint_mint_quote.request_lookup_id ?? null;
		this.pubkey = mint_mint_quote.pubkey ?? null;
		this.issued_time = mint_mint_quote.issued_time ?? null;
		this.created_time = mint_mint_quote.created_time;
		this.paid_time = mint_mint_quote.paid_time ?? null;
		this.amount_paid = mint_mint_quote.amount_paid;
		this.amount_issued = mint_mint_quote.amount_issued;
		this.payment_method = mint_mint_quote.payment_method;
	}
}
