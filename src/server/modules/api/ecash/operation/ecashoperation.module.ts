/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletModule} from '#server/modules/cashu/wallet/cashuwallet.module';
import {ErrorModule} from '#server/modules/error/error.module';
/* Local Dependencies */
import {EcashOperationResolver} from './ecashoperation.resolver.js';
import {EcashOperationService} from './ecashoperation.service.js';

@Module({
	imports: [CashuWalletModule, ErrorModule],
	providers: [EcashOperationResolver, EcashOperationService],
})
export class EcashOperationModule {}
