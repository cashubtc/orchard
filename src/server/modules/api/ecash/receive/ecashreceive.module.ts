/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletModule} from '#server/modules/cashu/wallet/cashuwallet.module';
import {ErrorModule} from '#server/modules/error/error.module';
/* Local Dependencies */
import {EcashReceiveResolver} from './ecashreceive.resolver.js';
import {EcashReceiveService} from './ecashreceive.service.js';

@Module({
	imports: [CashuWalletModule, ErrorModule],
	providers: [EcashReceiveResolver, EcashReceiveService],
})
export class EcashReceiveModule {}
