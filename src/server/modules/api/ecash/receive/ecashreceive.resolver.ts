/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Context, Float, ID} from '@nestjs/graphql';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';
import {normalizeMintUnit} from '#server/modules/cashu/cashu.helpers';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
/* Local Dependencies */
import {EcashReceiveService} from './ecashreceive.service.js';
import {OrchardEcashQuote, OrchardEcashTokenPreview} from './ecashreceive.model.js';

@Resolver()
export class EcashReceiveResolver {
	private readonly logger = new Logger(EcashReceiveResolver.name);

	constructor(private ecashReceiveService: EcashReceiveService) {}

	@Query(() => OrchardEcashTokenPreview, {description: "Read an ecash token before receiving it into the current user's wallet"})
	async ecash_receive_token_preview(
		@Context() context: any,
		@Args('token', {description: 'Encoded ecash token'}) token: string,
	): Promise<OrchardEcashTokenPreview> {
		const tag = 'GET { ecash_receive_token_preview }';
		this.logger.debug(tag);
		const allow_local = context.req.user.role === UserRole.ADMIN;
		return await this.ecashReceiveService.previewToken(tag, context.req.user.id, token, allow_local);
	}

	@Mutation(() => OrchardEcashOperation, {description: "Receive an ecash token into the current user's wallet"})
	async ecash_receive_token(
		@Context() context: any,
		@Args('token', {description: 'Encoded ecash token'}) token: string,
		@Args('add_mint', {nullable: true, defaultValue: false, description: "Add the token's mint to the wallet when it isn't there"})
		add_mint: boolean,
	): Promise<OrchardEcashOperation> {
		const tag = 'MUTATION { ecash_receive_token }';
		this.logger.debug(tag);
		const allow_local = context.req.user.role === UserRole.ADMIN;
		return await this.ecashReceiveService.receiveToken(tag, context.req.user.id, token, add_mint, allow_local);
	}

	@Mutation(() => OrchardEcashQuote, {
		description:
			"Get a payment request for the current user's wallet at one of its mints: a new bolt11 invoice, or a bolt12 offer or onchain address, reusing an unpaid one with the same terms",
	})
	async ecash_quote_new(
		@Context() context: any,
		@Args('mint_id', {type: () => ID, description: 'Wallet mint to receive at'}) mint_id: string,
		@Args('method', {description: 'Payment method: bolt11, bolt12 or onchain'}) method: string,
		@Args('unit', {description: 'Unit to receive'}) unit: string,
		@Args('amount', {
			type: () => Float,
			nullable: true,
			description: 'Amount in the smallest unit: required for bolt11, optional for bolt12, none for onchain',
		})
		amount: number | null,
		@Args('description', {type: () => String, nullable: true, description: 'Description payers see, when the mint takes one'})
		description: string | null,
	): Promise<OrchardEcashQuote> {
		const tag = 'MUTATION { ecash_quote_new }';
		this.logger.debug(tag);
		return await this.ecashReceiveService.newQuote(tag, {
			user_id: context.req.user.id,
			mint_id,
			method,
			unit: normalizeMintUnit(unit),
			amount: amount ?? null,
			description: description ?? null,
		});
	}

	@Mutation(() => OrchardEcashQuote, {
		description:
			"Get the bolt12 offer or onchain address the current user's wallet receives on at a mint, creating one when there's none",
	})
	async ecash_quote_open(
		@Context() context: any,
		@Args('mint_id', {type: () => ID, description: 'Wallet mint to receive at'}) mint_id: string,
		@Args('method', {description: 'Payment method: bolt12 or onchain'}) method: string,
		@Args('unit', {description: 'Unit to receive'}) unit: string,
	): Promise<OrchardEcashQuote> {
		const tag = 'MUTATION { ecash_quote_open }';
		this.logger.debug(tag);
		return await this.ecashReceiveService.openQuote(tag, context.req.user.id, mint_id, method, normalizeMintUnit(unit));
	}
}
