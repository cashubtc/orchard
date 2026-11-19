/* Core Dependencies */
import {Field, Float, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import type {
	CashuWalletMeltQuoteFee,
	CashuWalletMeltQuoteRecord,
	CashuWalletSendTokenPreview,
} from '#server/modules/cashu/wallet/cashuwallet.types';

@ObjectType({description: "What sending ecash as a token from the current user's wallet would cost, before anything is reserved"})
export class OrchardEcashSendTokenPreview {
	@Field(() => Float, {description: 'Amount the receiver gets, in the smallest unit'})
	amount: number;

	@Field(() => Float, {description: "Fee on top of the amount: the redeemer's fee the token carries plus the swap's input fee"})
	fee: number;

	@Field(() => Float, {description: 'Amount plus fee'})
	total: number;

	@Field({description: 'Whether the balance at the mint covers the total'})
	sufficient: boolean;

	@Field(() => Float, {description: 'Ready balance at the mint in the unit'})
	balance: number;

	constructor(preview: CashuWalletSendTokenPreview) {
		this.amount = preview.amount;
		this.fee = preview.fee;
		this.total = preview.total;
		this.sufficient = preview.sufficient;
		this.balance = preview.balance;
	}
}

@ObjectType({description: 'What paying a melt quote one way costs from the wallet: one way for Lightning, one per speed onchain'})
export class OrchardEcashMeltQuoteFee {
	@Field(() => Int, {nullable: true, description: 'Onchain speed to pay with; null for Lightning'})
	fee_index: number | null;

	@Field(() => Int, {nullable: true, description: 'Blocks the mint expects the onchain payment to confirm in; null for Lightning'})
	estimated_blocks: number | null;

	@Field(() => Float, {description: "Most the payment costs on top of the amount: the mint's fee reserve plus the input fee"})
	fee: number;

	@Field(() => Float, {description: 'Amount plus fee'})
	total: number;

	@Field({description: 'Whether the balance at the mint covers the total'})
	sufficient: boolean;

	constructor(fee: CashuWalletMeltQuoteFee) {
		this.fee_index = fee.fee_index;
		this.estimated_blocks = fee.estimated_blocks;
		this.fee = fee.fee;
		this.total = fee.total;
		this.sufficient = fee.sufficient;
	}
}

@ObjectType({
	description:
		"A melt quote for paying an invoice, offer or address from the current user's wallet, priced against its balance at the mint",
})
export class OrchardEcashMeltQuote {
	@Field({description: "The mint's melt quote id, which pays it"})
	quote_id: string;

	@Field(() => Float, {description: 'Amount the payment sends, in the smallest unit'})
	amount: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'When the melt quote expires; null when the mint sets none'})
	expiry: number | null;

	@Field(() => Float, {description: 'Ready balance at the mint in the unit'})
	balance: number;

	@Field(() => [OrchardEcashMeltQuoteFee], {description: 'What each way of paying costs'})
	fees: OrchardEcashMeltQuoteFee[];

	constructor(quote: CashuWalletMeltQuoteRecord) {
		this.quote_id = quote.quote_id;
		this.amount = quote.amount;
		this.expiry = quote.expiry;
		this.balance = quote.balance;
		this.fees = quote.fees.map((fee) => new OrchardEcashMeltQuoteFee(fee));
	}
}
