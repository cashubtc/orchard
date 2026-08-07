/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Internal Dependencies */
import {MintBalanceService} from './mintbalance.service.js';
import {OrchardMintBalance} from './mintbalance.model.js';

@Resolver(() => [OrchardMintBalance])
export class MintBalanceResolver {
	private readonly logger = new Logger(MintBalanceResolver.name);

	constructor(private mintBalanceService: MintBalanceService) {}

	@Query(() => [OrchardMintBalance], {description: 'Get mint balances, optionally filtered by keyset'})
	async mint_balances(
		@Args('keyset_id', {type: () => String, nullable: true, description: 'Keyset ID to filter by'}) keyset_id?: string,
	): Promise<OrchardMintBalance[]> {
		const tag = `GET { mint_balances ${keyset_id ? `for keyset ${keyset_id} ` : ''}}`;
		this.logger.debug(tag);
		return await this.mintBalanceService.getMintBalances(tag, keyset_id);
	}

	@Query(() => [OrchardMintBalance], {description: 'Get all issued mint balances'})
	async mint_balances_issued(): Promise<OrchardMintBalance[]> {
		const tag = 'GET { mint_balances_issued }';
		this.logger.debug(tag);
		return await this.mintBalanceService.getIssuedMintBalances(tag);
	}

	@Query(() => [OrchardMintBalance], {description: 'Get all redeemed mint balances'})
	async mint_balances_redeemed(): Promise<OrchardMintBalance[]> {
		const tag = 'GET { mint_balances_redeemed }';
		this.logger.debug(tag);
		return await this.mintBalanceService.getRedeemedMintBalances(tag);
	}
}
