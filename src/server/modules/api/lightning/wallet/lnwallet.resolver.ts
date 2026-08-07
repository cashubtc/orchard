/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {LightningWalletService} from './lnwallet.service.js';
import {OrchardLightningAccount} from './lnwallet.model.js';

@Resolver()
export class LightningWalletResolver {
	private readonly logger = new Logger(LightningWalletResolver.name);

	constructor(private lightningWalletService: LightningWalletService) {}

	@Query(() => [OrchardLightningAccount], {description: 'Get all lightning wallet accounts'})
	async lightning_wallet(): Promise<OrchardLightningAccount[]> {
		const tag = 'GET { lightning_wallet }';
		this.logger.debug(tag);
		return await this.lightningWalletService.getListAccounts(tag);
	}
}
