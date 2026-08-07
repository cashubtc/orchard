/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {BitcoinRpcModule} from '@server/modules/bitcoin/rpc/btcrpc.module';
/* Internal Dependencies */
import {BitcoinBlockResolver} from './btcblock.resolver.js';
import {BitcoinBlockService} from './btcblock.service.js';

@Module({
	imports: [ErrorModule, BitcoinRpcModule],
	providers: [BitcoinBlockResolver, BitcoinBlockService],
})
export class BitcoinBlockModule {}
