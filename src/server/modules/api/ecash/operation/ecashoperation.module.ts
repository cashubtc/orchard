/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletModule} from '#server/modules/cashu/wallet/cashuwallet.module';
import {ErrorModule} from '#server/modules/error/error.module';
import {EventLogModule} from '#server/modules/event/event.module';
/* Local Dependencies */
import {EcashOperationResolver} from './ecashoperation.resolver.js';
import {EcashOperationService} from './ecashoperation.service.js';
import {EcashOperationInterceptor} from './ecashoperation.interceptor.js';

@Module({
	imports: [CashuWalletModule, ErrorModule, EventLogModule],
	providers: [EcashOperationResolver, EcashOperationService, EcashOperationInterceptor],
})
export class EcashOperationModule {}
