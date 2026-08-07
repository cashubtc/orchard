/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {BitcoinRpcModule} from '#server/modules/bitcoin/rpc/btcrpc.module';
import {LndModule} from '#server/modules/lightning/lnd/lnd.module';
import {ClnModule} from '#server/modules/lightning/cln/cln.module';
/* Local Dependencies */
import {LightningService} from './lightning.service.js';

@Module({
	imports: [FetchModule, BitcoinRpcModule, LndModule, ClnModule],
	providers: [LightningService],
	exports: [LightningService],
})
export class LightningModule {}
