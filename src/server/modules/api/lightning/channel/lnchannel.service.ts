/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
import {LightningService} from '@server/modules/lightning/lightning/lightning.service';
import {LightningChannel, LightningClosedChannel} from '@server/modules/lightning/lightning/lightning.types';
/* Local Dependencies */
import {OrchardLightningChannel, OrchardLightningClosedChannel} from './lnchannel.model.js';

@Injectable()
export class LightningChannelService {
	private readonly logger = new Logger(LightningChannelService.name);

	constructor(
		private lightningService: LightningService,
		private errorService: ErrorService,
	) {}

	async getLightningChannels(tag: string): Promise<OrchardLightningChannel[]> {
		try {
			const channels: LightningChannel[] = await this.lightningService.getChannels();
			return channels.map((c) => new OrchardLightningChannel(c));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.LightningRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async getLightningClosedChannels(tag: string): Promise<OrchardLightningClosedChannel[]> {
		try {
			const closed_channels: LightningClosedChannel[] = await this.lightningService.getClosedChannels();
			return closed_channels.map((c) => new OrchardLightningClosedChannel(c));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.LightningRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
