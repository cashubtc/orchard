/* Core Dependencies */
import {Field, Float, ID, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {OrchardEcashMintLookup} from '#server/modules/api/ecash/mint/ecashmint.model';
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import type {CashuWalletQuoteRecord, CashuWalletTokenPreview} from '#server/modules/cashu/wallet/cashuwallet.types';

@ObjectType({description: "An ecash token read before receiving it into the current user's wallet"})
export class OrchardEcashTokenPreview {
	@Field(() => Float, {description: "Total of the token's proofs in the smallest unit, before the fee"})
	amount: number;

	@Field({description: 'Unit of the amount'})
	unit: string;

	@Field(() => String, {nullable: true, description: 'Note the sender attached'})
	memo: string | null;

	@Field(() => Float, {nullable: true, description: "The mint's fee for receiving it; null until its mint is in the wallet"})
	fee: number | null;

	@Field(() => Boolean, {nullable: true, description: 'Whether any of it is already spent; null until its mint is in the wallet'})
	claimed: boolean | null;

	@Field(() => OrchardEcashMintLookup, {description: 'The mint the token is from, and how it matches one in the wallet'})
	mint: OrchardEcashMintLookup;

	constructor(preview: CashuWalletTokenPreview) {
		this.amount = preview.amount;
		this.unit = preview.unit;
		this.memo = preview.memo;
		this.fee = preview.fee;
		this.claimed = preview.claimed;
		this.mint = new OrchardEcashMintLookup(preview.mint);
	}
}

@ObjectType({description: "A payment request the current user's wallet receives on: a bolt11 invoice, bolt12 offer or onchain address"})
export class OrchardEcashQuote {
	@Field(() => ID, {description: 'Quote identifier'})
	id: string;

	@Field({description: 'Wallet mint identifier'})
	mint_id: string;

	@Field({description: 'Payment method: bolt11, bolt12 or onchain'})
	method: string;

	@Field({description: 'Unit of the amounts'})
	unit: string;

	@Field({description: 'What payers pay to: the invoice, offer or address'})
	request: string;

	@Field(() => Float, {nullable: true, description: 'Fixed amount every payment must be, in the smallest unit; null when payers choose'})
	amount: number | null;

	@Field(() => String, {nullable: true, description: 'Description payers see'})
	description: string | null;

	@Field(() => UnixTimestamp, {nullable: true, description: 'When payers should stop paying it; null when it never expires'})
	expiry: number | null;

	@Field(() => Float, {description: 'Total the mint has seen paid to it, in the smallest unit'})
	amount_paid: number;

	@Field(() => Float, {description: 'Total minted into the wallet from it, in the smallest unit'})
	received: number;

	@Field(() => Int, {description: 'How many mints into the wallet its payments became'})
	payments: number;

	@Field({description: 'Whether it is the offer or address shown for its mint, method and unit'})
	latest: boolean;

	@Field(() => UnixTimestamp, {description: 'When the quote was created'})
	created_at: number;

	@Field(() => UnixTimestamp, {description: 'When the quote last changed'})
	updated_at: number;

	constructor(quote: CashuWalletQuoteRecord) {
		this.id = quote.id;
		this.mint_id = quote.mint_id;
		this.method = quote.method;
		this.unit = quote.unit;
		this.request = quote.request;
		this.amount = quote.amount;
		this.description = quote.description;
		this.expiry = quote.expiry;
		this.amount_paid = quote.amount_paid;
		this.received = quote.received;
		this.payments = quote.payments;
		this.latest = quote.latest;
		this.created_at = quote.created_at;
		this.updated_at = quote.updated_at;
	}
}
