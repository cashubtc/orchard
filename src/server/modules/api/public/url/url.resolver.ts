/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Local Dependencies */
import {PublicUrlService} from './url.service.js';
import {OrchardPublicUrl} from './url.model.js';

@Resolver(() => [OrchardPublicUrl])
export class PublicUrlResolver {
	private readonly logger = new Logger(PublicUrlResolver.name);

	constructor(private publicUrlService: PublicUrlService) {}

	@Query(() => [OrchardPublicUrl], {description: 'List URL reachability results'})
	async public_urls(@Args('urls', {type: () => [String], description: 'URLs to check'}) urls: string[]): Promise<OrchardPublicUrl[]> {
		this.logger.debug('GET { public_urls }');
		return await this.publicUrlService.getUrlsData(urls);
	}
}
