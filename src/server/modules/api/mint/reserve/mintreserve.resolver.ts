/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {MintReserveService} from './mintreserve.service.js';
import {OrchardMintReserves} from './mintreserve.model.js';

@Resolver()
export class MintReserveResolver {
	private readonly logger = new Logger(MintReserveResolver.name);

	constructor(private mintReserveService: MintReserveService) {}

	@Query(() => OrchardMintReserves, {description: 'Get the mint bitcoin liabilities and every reserve source that can back them'})
	async mint_reserves(): Promise<OrchardMintReserves> {
		const tag = 'GET { mint_reserves }';
		this.logger.debug(tag);
		return await this.mintReserveService.getMintReserves(tag);
	}
}
