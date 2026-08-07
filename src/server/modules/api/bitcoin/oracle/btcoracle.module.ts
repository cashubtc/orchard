/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {BitcoinRpcModule} from '@server/modules/bitcoin/rpc/btcrpc.module';
import {BitcoinUTXOracleModule} from '@server/modules/bitcoin/utxoracle/utxoracle.module';
/* Internal Dependencies */
import {BitcoinOracleResolver} from './btcoracle.resolver.js';
import {BitcoinOracleService} from './btcoracle.service.js';

@Module({
	imports: [ErrorModule, BitcoinRpcModule, BitcoinUTXOracleModule],
	providers: [BitcoinOracleResolver, BitcoinOracleService],
})
export class BitcoinOracleModule {}
