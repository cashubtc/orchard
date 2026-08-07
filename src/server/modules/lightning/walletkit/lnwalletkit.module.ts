/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {LndModule} from '#server/modules/lightning/lnd/lnd.module';
import {ClnModule} from '#server/modules/lightning/cln/cln.module';
/* Local Dependencies */
import {LightningWalletKitService} from './lnwalletkit.service.js';

@Module({
	imports: [FetchModule, LndModule, ClnModule],
	providers: [LightningWalletKitService],
	exports: [LightningWalletKitService],
})
export class LightningWalletKitModule {}
