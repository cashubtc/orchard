/* Core Dependencies */
import {Field, Int, ID, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {MintUnit, MintQuoteState} from '#server/modules/cashu/cashu.enums';
import {CashuMintMintQuote} from '#server/modules/cashu/mintdb/cashumintdb.types';

@ObjectType({description: 'Cashu mint quote for minting tokens'})
export class OrchardMintMintQuote {
	@Field(() => ID, {description: 'Unique identifier of the mint quote'})
	id: string;

	@Field(() => Int, {nullable: true, description: 'Quote amount in the specified unit'})
	amount: number;

	@Field(() => MintUnit, {description: 'Unit of the mint quote'})
	unit: string;

	@Field({description: 'Payment request for the mint quote'})
	request: string;

	@Field(() => MintQuoteState, {description: 'Current state of the mint quote'})
	state: MintQuoteState;

	@Field({nullable: true, description: 'Lookup identifier for the payment request'})
	request_lookup_id: string;

	@Field({nullable: true, description: 'Public key associated with the mint quote'})
	pubkey: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp when the quote was created'})
	created_time: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp when tokens were issued'})
	issued_time: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp when payment was received'})
	paid_time: number;

	@Field(() => Int, {description: 'Amount that has been paid'})
	amount_paid: number;

	@Field(() => Int, {description: 'Amount of tokens that have been issued'})
	amount_issued: number;

	@Field(() => String, {description: 'Payment method used for the quote'})
	payment_method: string;

	constructor(cashu_mint_mint_quote: CashuMintMintQuote) {
		this.id = cashu_mint_mint_quote.id;
		this.amount = cashu_mint_mint_quote.amount;
		this.unit = cashu_mint_mint_quote.unit;
		this.request = cashu_mint_mint_quote.request;
		this.state = cashu_mint_mint_quote.state;
		this.request_lookup_id = cashu_mint_mint_quote.request_lookup_id;
		this.pubkey = cashu_mint_mint_quote.pubkey;
		this.issued_time = cashu_mint_mint_quote.issued_time;
		this.created_time = cashu_mint_mint_quote.created_time;
		this.paid_time = cashu_mint_mint_quote.paid_time;
		this.amount_paid = cashu_mint_mint_quote.amount_paid;
		this.amount_issued = cashu_mint_mint_quote.amount_issued;
		this.payment_method = cashu_mint_mint_quote.payment_method;
	}
}

@ObjectType({description: 'Result of a NUT-04 mint quote settings update'})
export class OrchardMintNut04Update {
	@Field({description: 'Unit for the mint quote setting'})
	unit: string;

	@Field({description: 'Payment method for the mint quote setting'})
	method: string;

	@Field({nullable: true, description: 'Whether minting is disabled for this method'})
	disabled: boolean;

	@Field(() => Int, {nullable: true, description: 'Minimum allowed mint amount'})
	min_amount: number;

	@Field(() => Int, {nullable: true, description: 'Maximum allowed mint amount'})
	max_amount: number;

	@Field({nullable: true, description: 'Whether descriptions are enabled for mint quotes'})
	description: boolean;
}

@ObjectType({description: 'Result of a NUT-04 individual quote state update'})
export class OrchardMintNut04QuoteUpdate {
	@Field({description: 'Identifier of the updated quote'})
	quote_id: string;

	@Field({description: 'New state of the quote'})
	state: string;
}
