/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseModule} from '#server/modules/cashu/mintdb/cashumintdb.module';
import {CashuMintRpcModule} from '#server/modules/cashu/mintrpc/cashumintrpc.module';
import {LightningModule} from '#server/modules/lightning/lightning/lightning.module';
import {LightningWalletKitModule} from '#server/modules/lightning/walletkit/lnwalletkit.module';
import {ErrorModule} from '#server/modules/error/error.module';
import {MintService} from '#server/modules/api/mint/mint.service';
/* Local Dependencies */
import {MintReserveResolver} from './mintreserve.resolver.js';
import {MintReserveService} from './mintreserve.service.js';

@Module({
	imports: [CashuMintDatabaseModule, CashuMintRpcModule, LightningModule, LightningWalletKitModule, ErrorModule],
	providers: [MintReserveResolver, MintReserveService, MintService],
})
export class MintReserveModule {}
