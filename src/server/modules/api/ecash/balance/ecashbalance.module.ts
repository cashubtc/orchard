/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletModule} from '#server/modules/cashu/wallet/cashuwallet.module';
import {ErrorModule} from '#server/modules/error/error.module';
/* Local Dependencies */
import {EcashBalanceResolver} from './ecashbalance.resolver.js';
import {EcashBalanceService} from './ecashbalance.service.js';

@Module({
	imports: [CashuWalletModule, ErrorModule],
	providers: [EcashBalanceResolver, EcashBalanceService],
})
export class EcashBalanceModule {}
