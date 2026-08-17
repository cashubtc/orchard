/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {LightningModule} from '#server/modules/lightning/lightning/lightning.module';
import {CashuMintDatabaseModule} from '#server/modules/cashu/mintdb/cashumintdb.module';
import {MintService} from '#server/modules/api/mint/mint.service';
/* Local Dependencies */
import {LightningInfoService} from './lninfo.service.js';
import {LightningInfoResolver} from './lninfo.resolver.js';

@Module({
	imports: [LightningModule, CashuMintDatabaseModule, ErrorModule],
	providers: [LightningInfoService, LightningInfoResolver, MintService],
})
export class LightningInfoModule {}
