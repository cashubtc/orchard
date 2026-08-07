/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {BitcoinRpcModule} from '@server/modules/bitcoin/rpc/btcrpc.module';
/* Internal Dependencies */
import {BtcTransactionResolver} from './btctransaction.resolver.js';
import {BtcTransactionService} from './btctransaction.service.js';

@Module({
	imports: [ErrorModule, BitcoinRpcModule],
	providers: [BtcTransactionResolver, BtcTransactionService],
})
export class BitcoinTransactionModule {}
