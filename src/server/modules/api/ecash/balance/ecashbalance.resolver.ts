/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Context} from '@nestjs/graphql';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {EcashBalanceService} from './ecashbalance.service.js';
import {OrchardEcashBalance} from './ecashbalance.model.js';

@Resolver(() => [OrchardEcashBalance])
export class EcashBalanceResolver {
	private readonly logger = new Logger(EcashBalanceResolver.name);

	constructor(private ecashBalanceService: EcashBalanceService) {}

	@Query(() => [OrchardEcashBalance], {description: "Get the current user's ecash wallet balances by unit and keyset"})
	async ecash_balances(@Context() context: any): Promise<OrchardEcashBalance[]> {
		const tag = 'GET { ecash_balances }';
		this.logger.debug(tag);
		const user = context.req.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.UserError);
		return await this.ecashBalanceService.getEcashBalances(tag, user.id);
	}
}
