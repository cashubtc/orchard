/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Context} from '@nestjs/graphql';
/* Local Dependencies */
import {EcashBalanceService} from './ecashbalance.service.js';
import {OrchardEcashBalance} from './ecashbalance.model.js';

@Resolver(() => [OrchardEcashBalance])
export class EcashBalanceResolver {
	private readonly logger = new Logger(EcashBalanceResolver.name);

	constructor(private ecashBalanceService: EcashBalanceService) {}

	@Query(() => [OrchardEcashBalance], {description: "Get the current user's ecash wallet balances by mint and unit"})
	async ecash_balances(@Context() context: any): Promise<OrchardEcashBalance[]> {
		const tag = 'GET { ecash_balances }';
		this.logger.debug(tag);
		return await this.ecashBalanceService.getEcashBalances(tag, context.req.user.id);
	}
}
