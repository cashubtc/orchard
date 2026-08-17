/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {CoreModule} from '#server/modules/bitcoin/core/core.module';
/* Local Dependencies */
import {BitcoinRpcService} from './btcrpc.service.js';

@Module({
	imports: [FetchModule, CoreModule],
	providers: [BitcoinRpcService],
	exports: [BitcoinRpcService],
})
export class BitcoinRpcModule {}
