/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Context} from '@nestjs/graphql';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
/* Local Dependencies */
import {EcashReceiveService} from './ecashreceive.service.js';
import {OrchardEcashTokenPreview} from './ecashreceive.model.js';

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
}
