/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletModule} from '#server/modules/cashu/wallet/cashuwallet.module';
import {ErrorModule} from '#server/modules/error/error.module';
/* Local Dependencies */
import {EcashSendResolver} from './ecashsend.resolver.js';
import {EcashSendService} from './ecashsend.service.js';

@Module({
	imports: [CashuWalletModule, ErrorModule],
	providers: [EcashSendResolver, EcashSendService],
})
export class EcashSendModule {}
