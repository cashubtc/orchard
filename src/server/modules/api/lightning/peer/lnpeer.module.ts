/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {LightningModule} from '#server/modules/lightning/lightning/lightning.module';
/* Local Dependencies */
import {LightningPeerService} from './lnpeer.service.js';
import {LightningPeerResolver} from './lnpeer.resolver.js';

@Module({
	imports: [LightningModule, ErrorModule],
	providers: [LightningPeerService, LightningPeerResolver],
})
export class LightningPeerModule {}
