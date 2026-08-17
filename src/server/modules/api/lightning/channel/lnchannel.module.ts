/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {LightningModule} from '#server/modules/lightning/lightning/lightning.module';
/* Local Dependencies */
import {LightningChannelService} from './lnchannel.service.js';
import {LightningChannelResolver} from './lnchannel.resolver.js';

@Module({
	imports: [LightningModule, ErrorModule],
	providers: [LightningChannelService, LightningChannelResolver],
})
export class LightningChannelModule {}
