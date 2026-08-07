/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {LightningBalanceService} from './lnbalance.service.js';
import {OrchardLightningBalance} from './lnbalance.model.js';

@Resolver()
export class LightningBalanceResolver {
	private readonly logger = new Logger(LightningBalanceResolver.name);

	constructor(private lightningBalanceService: LightningBalanceService) {}

	@Query(() => OrchardLightningBalance, {description: 'Get lightning channel balance summary'})
	async lightning_balance(): Promise<OrchardLightningBalance> {
		const tag = 'GET { lightning_balance }';
		this.logger.debug(tag);
		return await this.lightningBalanceService.getLightningChannelBalance(tag);
	}
}
