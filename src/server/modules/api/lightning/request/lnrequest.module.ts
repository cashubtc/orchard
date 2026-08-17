/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {LightningModule} from '#server/modules/lightning/lightning/lightning.module';
/* Local Dependencies */
import {LightningRequestService} from './lnrequest.service.js';
import {LightningRequestResolver} from './lnrequest.resolver.js';

@Module({
	imports: [LightningModule, ErrorModule],
	providers: [LightningRequestService, LightningRequestResolver],
})
export class LightningRequestModule {}
