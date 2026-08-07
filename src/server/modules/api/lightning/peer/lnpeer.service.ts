/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
import {LightningService} from '@server/modules/lightning/lightning/lightning.service';
/* Local Dependencies */
import {OrchardLightningPeer} from './lnpeer.model.js';

@Injectable()
export class LightningPeerService {
	private readonly logger = new Logger(LightningPeerService.name);

	constructor(
		private lightningService: LightningService,
		private errorService: ErrorService,
	) {}

	/**
	 * Gets connected peers enriched with node aliases
	 */
	async getLightningPeers(tag: string): Promise<OrchardLightningPeer[]> {
		try {
			const peers = await this.lightningService.getPeers();
			const enriched = await Promise.all(
				peers.map(async (p) => {
					const alias = await this.lightningService.getNodeAlias(p.pubkey).catch(() => null);
					return new OrchardLightningPeer({...p, alias});
				}),
			);
			return enriched;
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.LightningRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
