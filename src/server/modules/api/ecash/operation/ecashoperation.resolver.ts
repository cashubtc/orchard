/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Mutation, Args, Context, Int} from '@nestjs/graphql';
/* Application Dependencies */
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {normalizeMintUnit} from '#server/modules/cashu/cashu.helpers';
/* Local Dependencies */
import {EcashOperationService} from './ecashoperation.service.js';
import {OrchardEcashOperation} from './ecashoperation.model.js';

@Resolver()
export class EcashOperationResolver {
	private readonly logger = new Logger(EcashOperationResolver.name);

	constructor(private ecashOperationService: EcashOperationService) {}

	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardEcashOperation, {description: "Issue ecash on the Orchard mint into the current user's wallet"})
	async ecash_issue(
		@Context() context: any,
		@Args('unit', {description: 'Unit to issue'}) unit: string,
		@Args('amount', {type: () => Int, description: 'Amount in the smallest unit'}) amount: number,
		@Args('memo', {type: () => String, nullable: true, description: 'Note shown in wallet history'}) memo: string | null,
	): Promise<OrchardEcashOperation> {
		const tag = 'MUTATION { ecash_issue }';
		this.logger.debug(tag);
		return await this.ecashOperationService.issueEcash(tag, context.req.user.id, normalizeMintUnit(unit), amount, memo ?? null);
	}
}
