/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {BitcoinRpcModule} from '@server/modules/bitcoin/rpc/btcrpc.module';
/* Internal Dependencies */
import {BitcoinBlockchainResolver} from './btcblockchain.resolver.js';
import {BitcoinBlockchainService} from './btcblockchain.service.js';

@Module({
	imports: [ErrorModule, BitcoinRpcModule],
	providers: [BitcoinBlockchainResolver, BitcoinBlockchainService],
})
export class BitcoinBlockchainModule {}
