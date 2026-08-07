/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {BitcoinRpcModule} from '@server/modules/bitcoin/rpc/btcrpc.module';
/* Local Dependencies */
import {BitcoinUTXOracleService} from './utxoracle.service.js';
import {UTXOracle} from './utxoracle.entity.js';

@Module({
	imports: [BitcoinRpcModule, TypeOrmModule.forFeature([UTXOracle])],
	providers: [BitcoinUTXOracleService],
	exports: [BitcoinUTXOracleService],
})
export class BitcoinUTXOracleModule {}
