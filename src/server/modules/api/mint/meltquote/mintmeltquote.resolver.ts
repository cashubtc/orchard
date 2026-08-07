/* Core Dependencies */
import {Logger, UseInterceptors} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Int} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
import {MintUnit, MeltQuoteState} from '@server/modules/cashu/cashu.enums';
import {Roles} from '@server/modules/auth/decorators/auth.decorator';
import {UserRole} from '@server/modules/user/user.enums';
import {LogEvent} from '@server/modules/event/event.decorator';
import {EventLogType} from '@server/modules/event/event.enums';
/* Local Dependencies */
import {MintMeltQuoteService} from './mintmeltquote.service.js';
import {MintMeltQuoteInterceptor} from './mintmeltquote.interceptor.js';
import {OrchardMintMeltQuote} from './mintmeltquote.model.js';
import {OrchardMintNut05Update, OrchardMintNut05QuoteUpdate} from './mintmeltquote.model.js';

@Resolver()
export class MintMeltQuoteResolver {
	private readonly logger = new Logger(MintMeltQuoteResolver.name);

	constructor(private mintMeltQuoteService: MintMeltQuoteService) {}

	@Query(() => [OrchardMintMeltQuote], {description: 'List melt quotes with optional filters'})
	async mint_melt_quotes(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Filter by unit types'}) units?: MintUnit[],
		@Args('states', {type: () => [MeltQuoteState], nullable: true, description: 'Filter by quote states'}) states?: MeltQuoteState[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('page', {type: () => Int, nullable: true, description: 'Page number for pagination'}) page?: number,
		@Args('page_size', {type: () => Int, nullable: true, description: 'Number of results per page'}) page_size?: number,
	): Promise<OrchardMintMeltQuote[]> {
		const tag = 'GET { mint_melt_quotes }';
		this.logger.debug(tag);
		return await this.mintMeltQuoteService.getMintMeltQuotes(tag, {units, states, date_start, date_end, page, page_size});
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintMeltQuoteInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'nut05',
	})
	@Mutation(() => OrchardMintNut05Update, {description: 'Update NUT-05 melt quote settings for a unit and method'})
	async mint_nut05_update(
		@Args('unit', {description: 'Unit to update settings for'}) unit: string,
		@Args('method', {description: 'Payment method to update settings for'}) method: string,
		@Args('disabled', {nullable: true, description: 'Whether to disable melting for this method'}) disabled: boolean,
		@Args('min_amount', {type: () => Int, nullable: true, description: 'Minimum allowed melt amount'}) min_amount: number,
		@Args('max_amount', {type: () => Int, nullable: true, description: 'Maximum allowed melt amount'}) max_amount: number,
	): Promise<OrchardMintNut05Update> {
		const tag = 'MUTATION { mint_nut05_update }';
		this.logger.debug(tag);
		return await this.mintMeltQuoteService.updateMintNut05(tag, unit, method, disabled, min_amount, max_amount);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintMeltQuoteInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'nut05_quote',
	})
	@Mutation(() => OrchardMintNut05QuoteUpdate, {description: 'Update the state of an individual melt quote'})
	async mint_nut05_quote_update(
		@Args('quote_id', {description: 'Identifier of the quote to update'}) quote_id: string,
		@Args('state', {description: 'New state to set on the quote'}) state: string,
	): Promise<OrchardMintNut05QuoteUpdate> {
		const tag = 'MUTATION { mint_nut05_quote_update }';
		this.logger.debug(tag);
		return await this.mintMeltQuoteService.updateMintNut05Quote(tag, quote_id, state);
	}
}
