/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {MintActivityPeriod} from '#server/modules/cashu/mintdb/cashumintdb.enums';
import {Timezone, type TimezoneType} from '#server/modules/graphql/scalars/timezone.scalar';
/* Local Dependencies */
import {OrchardMintActivitySummary} from './mintactivity.model.js';
import {MintActivityService} from './mintactivity.service.js';

@Resolver()
export class MintActivityResolver {
	private readonly logger = new Logger(MintActivityResolver.name);

	constructor(private mintActivityService: MintActivityService) {}

	@Query(() => OrchardMintActivitySummary, {description: 'Get mint activity summary for a time period'})
	async mint_activity_summary(
		@Args('period', {type: () => MintActivityPeriod, description: 'Time period to summarize activity for'}) period: MintActivityPeriod,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintActivitySummary> {
		const tag = 'GET { mint_activity_summary }';
		this.logger.debug(tag);
		return await this.mintActivityService.getMintActivitySummary(tag, period, timezone);
	}
}
