/* Core Dependencies */
import {Field, Int, ID, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {MintUnit, MeltQuoteState} from '#server/modules/cashu/cashu.enums';
import type {CashuMintMeltQuote} from '#server/modules/cashu/mintdb/cashumintdb.types';

@ObjectType({description: 'Cashu mint quote for melting tokens'})
export class OrchardMintMeltQuote {
	@Field(() => ID, {description: 'Unique identifier of the melt quote'})
	id: string;

	@Field(() => MintUnit, {description: 'Unit of the melt quote'})
	unit: string;

	@Field(() => Int, {description: 'Amount to melt in the specified unit'})
	amount: number;

	@Field({description: 'Payment request to be paid for melting'})
	request: string;

	@Field(() => Int, {description: 'Fee reserve for the melt payment'})
	fee_reserve: number;

	@Field(() => MeltQuoteState, {description: 'Current state of the melt quote'})
	state: MeltQuoteState;

	@Field({nullable: true, description: 'Payment preimage proving payment was made'})
	payment_preimage: string;

	@Field({nullable: true, description: 'Lookup identifier for the payment request'})
	request_lookup_id: string;

	@Field(() => Int, {nullable: true, description: 'Amount in millisatoshis to pay'})
	msat_to_pay: number;

	@Field(() => UnixTimestamp, {description: 'Timestamp when the quote was created'})
	created_time: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp when payment was made'})
	paid_time: number;

	@Field(() => String, {description: 'Payment method used for the quote'})
	payment_method: string;

	constructor(cashu_mint_melt_quote: CashuMintMeltQuote) {
		this.id = cashu_mint_melt_quote.id;
		this.request = cashu_mint_melt_quote.request;
		this.request_lookup_id = cashu_mint_melt_quote.request_lookup_id;
		this.unit = cashu_mint_melt_quote.unit;
		this.amount = cashu_mint_melt_quote.amount;
		this.fee_reserve = cashu_mint_melt_quote.fee_reserve;
		this.state = cashu_mint_melt_quote.state;
		this.payment_preimage = cashu_mint_melt_quote.payment_preimage;
		this.created_time = cashu_mint_melt_quote.created_time;
		this.paid_time = cashu_mint_melt_quote.paid_time;
		this.msat_to_pay = cashu_mint_melt_quote.msat_to_pay;
		this.payment_method = cashu_mint_melt_quote.payment_method;
	}
}

@ObjectType({description: 'Result of a NUT-05 melt quote settings update'})
export class OrchardMintNut05Update {
	@Field({description: 'Unit for the melt quote setting'})
	unit: string;

	@Field({description: 'Payment method for the melt quote setting'})
	method: string;

	@Field({nullable: true, description: 'Whether melting is disabled for this method'})
	disabled: boolean;

	@Field(() => Int, {nullable: true, description: 'Minimum allowed melt amount'})
	min_amount: number;

	@Field(() => Int, {nullable: true, description: 'Maximum allowed melt amount'})
	max_amount: number;
}

@ObjectType({description: 'Result of a NUT-05 individual quote state update'})
export class OrchardMintNut05QuoteUpdate {
	@Field({description: 'Identifier of the updated quote'})
	quote_id: string;

	@Field({description: 'New state of the quote'})
	state: string;
}
