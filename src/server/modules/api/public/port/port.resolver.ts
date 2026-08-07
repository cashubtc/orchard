/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Local Dependencies */
import {PublicPortService} from './port.service.js';
import {OrchardPublicPort} from './port.model.js';
import {PublicPortInput} from './port.input.js';

@Resolver(() => [OrchardPublicPort])
export class PublicPortResolver {
	private readonly logger = new Logger(PublicPortResolver.name);

	constructor(private publicPortService: PublicPortService) {}

	@Query(() => [OrchardPublicPort], {description: 'List port reachability results'})
	async public_ports(
		@Args('targets', {type: () => [PublicPortInput], description: 'Host and port pairs to check'}) targets: PublicPortInput[],
	): Promise<OrchardPublicPort[]> {
		this.logger.debug('GET { public_ports }');
		return await this.publicPortService.getPortsData(targets);
	}
}
