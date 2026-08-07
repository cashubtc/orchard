/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args, Int} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
import {MintUnit} from '@server/modules/cashu/cashu.enums';
/* Local Dependencies */
import {MintSwapService} from './mintswap.service.js';
import {OrchardMintSwap} from './mintswap.model.js';

@Resolver()
export class MintSwapResolver {
	private readonly logger = new Logger(MintSwapResolver.name);

	constructor(private mintSwapService: MintSwapService) {}

	@Query(() => [OrchardMintSwap], {description: 'List mint swap operations'})
	async mint_swaps(
		@Args('id_keysets', {type: () => [String], nullable: true, description: 'Keyset IDs to filter swaps by'}) id_keysets?: string[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Units to filter swaps by'}) units?: MintUnit[],
		@Args('page', {type: () => Int, nullable: true, description: 'Page number for pagination'}) page?: number,
		@Args('page_size', {type: () => Int, nullable: true, description: 'Number of results per page'}) page_size?: number,
	): Promise<OrchardMintSwap[]> {
		const tag = 'GET { mint_swaps }';
		this.logger.debug(tag);
		return await this.mintSwapService.getMintSwaps(tag, {id_keysets, date_start, date_end, units, page, page_size});
	}
}
