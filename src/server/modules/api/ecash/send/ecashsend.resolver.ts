/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Context, Float, ID} from '@nestjs/graphql';
/* Vendor Dependencies */
import {Throttle, minutes} from '@nestjs/throttler';
/* Application Dependencies */
import {normalizeMintUnit} from '#server/modules/cashu/cashu.helpers';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
/* Local Dependencies */
import {EcashSendService} from './ecashsend.service.js';
import {OrchardEcashMeltQuote, OrchardEcashSendTokenPreview} from './ecashsend.model.js';

@Resolver()
export class EcashSendResolver {
	private readonly logger = new Logger(EcashSendResolver.name);

	constructor(private ecashSendService: EcashSendService) {}

	@Query(() => OrchardEcashSendTokenPreview, {
		description: "Price sending ecash from the current user's wallet as a token, the redeemer's fee included; nothing is reserved",
	})
	async ecash_send_token_preview(
		@Context() context: any,
		@Args('mint_id', {type: () => ID, description: 'Wallet mint to send from'}) mint_id: string,
		@Args('unit', {description: 'Unit to send'}) unit: string,
		@Args('amount', {type: () => Float, nullable: true, description: 'Amount the receiver gets, in the smallest unit; none with max'})
		amount: number | null,
		@Args('max', {nullable: true, defaultValue: false, description: 'Price the most the wallet can send instead of an amount'})
		max: boolean,
	): Promise<OrchardEcashSendTokenPreview> {
		const tag = 'GET { ecash_send_token_preview }';
		this.logger.debug(tag);
		return await this.ecashSendService.previewSend(tag, {
			user_id: context.req.user.id,
			mint_id,
			unit: normalizeMintUnit(unit),
			amount: amount ?? null,
			max,
		});
	}

	@Throttle({default: {limit: 20, ttl: minutes(1)}})
	@Mutation(() => OrchardEcashMeltQuote, {
		description:
			"Get a melt quote for paying an invoice, offer or address from the current user's wallet, priced against its balance at the mint; nothing is reserved",
	})
	async ecash_melt_quote_new(
		@Context() context: any,
		@Args('mint_id', {type: () => ID, description: 'Wallet mint to pay from'}) mint_id: string,
		@Args('method', {description: 'Payment method: bolt11, bolt12 or onchain'}) method: string,
		@Args('unit', {description: 'Unit to pay with'}) unit: string,
		@Args('request', {description: 'Invoice, offer or address to pay'}) request: string,
		@Args('amount', {
			type: () => Float,
			nullable: true,
			description:
				'Amount to send in the smallest unit: required for onchain and for invoices and offers that set none, in sat or msat for Lightning',
		})
		amount: number | null,
		@Args('max', {nullable: true, defaultValue: false, description: 'Quote the most the wallet can pay instead of an amount'})
		max: boolean,
	): Promise<OrchardEcashMeltQuote> {
		const tag = 'MUTATION { ecash_melt_quote_new }';
		this.logger.debug(tag);
		return await this.ecashSendService.newMeltQuote(tag, {
			user_id: context.req.user.id,
			mint_id,
			method,
			unit: normalizeMintUnit(unit),
			request,
			amount: amount ?? null,
			max,
		});
	}

	@Mutation(() => OrchardEcashOperation, {
		description: "Send ecash from the current user's wallet as a token; ecash_operation_token returns the token",
	})
	async ecash_send_token(
		@Context() context: any,
		@Args('mint_id', {type: () => ID, description: 'Wallet mint to send from'}) mint_id: string,
		@Args('unit', {description: 'Unit to send'}) unit: string,
		@Args('amount', {type: () => Float, description: 'Amount the receiver gets, in the smallest unit'}) amount: number,
		@Args('memo', {type: () => String, nullable: true, description: 'Note carried in the token'}) memo: string | null,
	): Promise<OrchardEcashOperation> {
		const tag = 'MUTATION { ecash_send_token }';
		this.logger.debug(tag);
		return await this.ecashSendService.sendToken(tag, {
			user_id: context.req.user.id,
			mint_id,
			unit: normalizeMintUnit(unit),
			amount,
			memo: memo ?? null,
		});
	}

	@Mutation(() => OrchardEcashOperation, {description: "Check whether a token sent from the current user's wallet was claimed"})
	async ecash_send_check(
		@Context() context: any,
		@Args('id', {type: () => ID, description: 'Send operation identifier'}) id: string,
	): Promise<OrchardEcashOperation> {
		const tag = 'MUTATION { ecash_send_check }';
		this.logger.debug(tag);
		return await this.ecashSendService.checkToken(tag, context.req.user.id, id);
	}

	@Mutation(() => OrchardEcashOperation, {description: "Take back what's left unclaimed of a token sent from the current user's wallet"})
	async ecash_send_reclaim(
		@Context() context: any,
		@Args('id', {type: () => ID, description: 'Send operation identifier'}) id: string,
	): Promise<OrchardEcashOperation> {
		const tag = 'MUTATION { ecash_send_reclaim }';
		this.logger.debug(tag);
		return await this.ecashSendService.reclaimToken(tag, context.req.user.id, id);
	}
}
