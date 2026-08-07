/* Core Dependencies */
import {Logger, UseInterceptors} from '@nestjs/common';
import {Resolver, Query, Args, Mutation} from '@nestjs/graphql';
/* Application Dependencies */
import {Roles} from '@server/modules/auth/decorators/auth.decorator';
import {UserRole} from '@server/modules/user/user.enums';
import {LogEvent} from '@server/modules/event/event.decorator';
import {EventLogType} from '@server/modules/event/event.enums';
/* Local Dependencies */
import {MintQuoteService} from './mintquote.service.js';
import {MintQuoteInterceptor} from './mintquote.interceptor.js';
import {OrchardMintQuoteTtls} from './mintquote.model.js';
import {MintQuoteTtlUpdateInput} from './mintquote.input.js';

@Resolver(() => [OrchardMintQuoteTtls])
export class MintQuoteResolver {
	private readonly logger = new Logger(MintQuoteResolver.name);

	constructor(private mintQuoteService: MintQuoteService) {}

	@Query(() => OrchardMintQuoteTtls, {description: 'Get mint quote TTL settings'})
	async mint_quote_ttl(): Promise<OrchardMintQuoteTtls> {
		const tag = 'GET { mint_quote_ttl }';
		this.logger.debug(tag);
		return await this.mintQuoteService.getMintQuoteTtl(tag);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintQuoteInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'quote_ttl',
	})
	@Mutation(() => OrchardMintQuoteTtls, {description: 'Update mint quote TTL settings'})
	async mint_quote_ttl_update(
		@Args('mint_quote_ttl_update', {description: 'Quote TTL values to update'}) mint_quote_ttl_update: MintQuoteTtlUpdateInput,
	): Promise<OrchardMintQuoteTtls> {
		const tag = 'MUTATION { mint_quote_ttl_update }';
		this.logger.debug(tag);
		return await this.mintQuoteService.updateMintQuoteTtl(tag, mint_quote_ttl_update);
	}
}
