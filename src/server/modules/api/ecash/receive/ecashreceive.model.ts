/* Core Dependencies */
import {Field, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {OrchardEcashMintLookup} from '#server/modules/api/ecash/mint/ecashmint.model';
import type {CashuWalletTokenPreview} from '#server/modules/cashu/wallet/cashuwallet.types';

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
