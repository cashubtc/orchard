/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {MintUnit, MintQuoteState, MeltQuoteState} from '#server/modules/cashu/cashu.enums';
/* Local Dependencies */
import {MintCountService} from './mintcount.service.js';
import {OrchardMintCount} from './mintcount.model.js';

@Resolver(() => OrchardMintCount)
export class MintCountResolver {
	private readonly logger = new Logger(MintCountResolver.name);

	constructor(private mintCountService: MintCountService) {}

	@Query(() => OrchardMintCount, {description: 'Get count of mint quotes'})
	async mint_count_mint_quotes(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Units to filter mint quotes by'}) units?: MintUnit[],
		@Args('states', {type: () => [MintQuoteState], nullable: true, description: 'States to filter mint quotes by'})
		states?: MintQuoteState[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
	): Promise<OrchardMintCount> {
		const tag = 'GET { mint_count_mint_quotes }';
		this.logger.debug(tag);
		return await this.mintCountService.getMintCountMintQuotes(tag, {units, states, date_start, date_end});
	}

	@Query(() => OrchardMintCount, {description: 'Get count of melt quotes'})
	async mint_count_melt_quotes(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Units to filter melt quotes by'}) units?: MintUnit[],
		@Args('states', {type: () => [MeltQuoteState], nullable: true, description: 'States to filter melt quotes by'})
		states?: MeltQuoteState[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
	): Promise<OrchardMintCount> {
		const tag = 'GET { mint_count_melt_quotes }';
		this.logger.debug(tag);
		return await this.mintCountService.getMintCountMeltQuotes(tag, {units, states, date_start, date_end});
	}

	@Query(() => OrchardMintCount, {description: 'Get count of swap operations'})
	async mint_count_swaps(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Units to filter swaps by'}) units?: MintUnit[],
		@Args('id_keysets', {type: () => [String], nullable: true, description: 'Keyset IDs to filter swaps by'}) id_keysets?: string[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
	): Promise<OrchardMintCount> {
		const tag = 'GET { mint_count_swaps }';
		this.logger.debug(tag);
		return await this.mintCountService.getMintCountSwaps(tag, {units, id_keysets, date_start, date_end});
	}
}
