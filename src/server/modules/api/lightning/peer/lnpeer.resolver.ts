/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {LightningPeerService} from './lnpeer.service.js';
import {OrchardLightningPeer} from './lnpeer.model.js';

@Resolver()
export class LightningPeerResolver {
	private readonly logger = new Logger(LightningPeerResolver.name);

	constructor(private lightningPeerService: LightningPeerService) {}

	@Query(() => [OrchardLightningPeer], {description: 'Get all connected lightning peers'})
	async lightning_peers(): Promise<OrchardLightningPeer[]> {
		const tag = 'GET { lightning_peers }';
		this.logger.debug(tag);
		return await this.lightningPeerService.getLightningPeers(tag);
	}
}
