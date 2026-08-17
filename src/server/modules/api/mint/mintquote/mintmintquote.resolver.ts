/* Core Dependencies */
import {Logger, UseInterceptors} from '@nestjs/common';
import {Resolver, Query, Args, Mutation, Int} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {MintUnit, MintQuoteState} from '#server/modules/cashu/cashu.enums';
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {LogEvent} from '#server/modules/event/event.decorator';
import {EventLogType} from '#server/modules/event/event.enums';
/* Local Dependencies */
import {MintMintQuoteService} from './mintmintquote.service.js';
import {MintMintQuoteInterceptor} from './mintmintquote.interceptor.js';
import {OrchardMintMintQuote} from './mintmintquote.model.js';
import {OrchardMintNut04Update, OrchardMintNut04QuoteUpdate} from './mintmintquote.model.js';

@Resolver()
export class MintMintQuoteResolver {
	private readonly logger = new Logger(MintMintQuoteResolver.name);

	constructor(private mintMintQuoteService: MintMintQuoteService) {}

	@Query(() => [OrchardMintMintQuote], {description: 'List mint quotes with optional filters'})
	async mint_mint_quotes(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Filter by unit types'}) units?: MintUnit[],
		@Args('states', {type: () => [MintQuoteState], nullable: true, description: 'Filter by quote states'}) states?: MintQuoteState[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('page', {type: () => Int, nullable: true, description: 'Page number for pagination'}) page?: number,
		@Args('page_size', {type: () => Int, nullable: true, description: 'Number of results per page'}) page_size?: number,
	): Promise<OrchardMintMintQuote[]> {
		const tag = 'GET { mint_mint_quotes }';
		this.logger.debug(tag);
		return await this.mintMintQuoteService.getMintMintQuotes(tag, {units, states, date_start, date_end, page, page_size});
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintMintQuoteInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'nut04',
	})
	@Mutation(() => OrchardMintNut04Update, {description: 'Update NUT-04 mint quote settings for a unit and method'})
	async mint_nut04_update(
		@Args('unit', {description: 'Unit to update settings for'}) unit: string,
		@Args('method', {description: 'Payment method to update settings for'}) method: string,
		@Args('disabled', {nullable: true, description: 'Whether to disable minting for this method'}) disabled: boolean,
		@Args('min_amount', {type: () => Int, nullable: true, description: 'Minimum allowed mint amount'}) min_amount: number,
		@Args('max_amount', {type: () => Int, nullable: true, description: 'Maximum allowed mint amount'}) max_amount: number,
		@Args('description', {nullable: true, description: 'Whether to enable descriptions for mint quotes'}) description: boolean,
	): Promise<OrchardMintNut04Update> {
		const tag = 'MUTATION { mint_nut04_update }';
		this.logger.debug(tag);
		return await this.mintMintQuoteService.updateMintNut04(tag, unit, method, disabled, min_amount, max_amount, description);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintMintQuoteInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'nut04_quote',
	})
	@Mutation(() => OrchardMintNut04QuoteUpdate, {description: 'Update the state of an individual mint quote'})
	async mint_nut04_quote_update(
		@Args('quote_id', {description: 'Identifier of the quote to update'}) quote_id: string,
		@Args('state', {description: 'New state to set on the quote'}) state: string,
	): Promise<OrchardMintNut04QuoteUpdate> {
		const tag = 'MUTATION { mint_nut04_quote_update }';
		this.logger.debug(tag);
		return await this.mintMintQuoteService.updateMintNut04Quote(tag, quote_id, state);
	}
}
