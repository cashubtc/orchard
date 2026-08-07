/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {StatusService} from './status.service.js';
import {OrchardStatus} from './status.model.js';

@Resolver(() => OrchardStatus)
export class StatusResolver {
	private readonly logger = new Logger(StatusResolver.name);

	constructor(private statusService: StatusService) {}

	@Query(() => OrchardStatus, {description: 'Get the application status'})
	async status(): Promise<OrchardStatus> {
		this.logger.debug('GET { status }');
		return await this.statusService.getStatus();
	}
}
