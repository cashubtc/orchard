/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Mutation, Args, Context, Float, ID} from '@nestjs/graphql';
/* Application Dependencies */
import {normalizeMintUnit} from '#server/modules/cashu/cashu.helpers';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
/* Local Dependencies */
import {EcashSendService} from './ecashsend.service.js';

@Resolver()
export class EcashSendResolver {
	private readonly logger = new Logger(EcashSendResolver.name);

	constructor(private ecashSendService: EcashSendService) {}

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
