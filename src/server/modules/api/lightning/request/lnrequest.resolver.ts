/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Local Dependencies */
import {LightningRequestService} from './lnrequest.service.js';
import {OrchardLightningRequest} from './lnrequest.model.js';

@Resolver()
export class LightningRequestResolver {
	private readonly logger = new Logger(LightningRequestResolver.name);

	constructor(private lightningRequestService: LightningRequestService) {}

	@Query(() => OrchardLightningRequest, {description: 'Look up and decode a lightning payment request'})
	async lightning_request(
		@Args('request', {type: () => String, description: 'Encoded lightning payment request string'}) request: string,
	): Promise<OrchardLightningRequest> {
		const tag = 'GET { lightning_request }';
		this.logger.debug(tag);
		return await this.lightningRequestService.getLightningRequest(tag, request);
	}
}
