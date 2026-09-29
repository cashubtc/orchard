/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletModule} from '#server/modules/cashu/wallet/cashuwallet.module';
import {ErrorModule} from '#server/modules/error/error.module';
/* Local Dependencies */
import {EcashMintResolver} from './ecashmint.resolver.js';
import {EcashMintService} from './ecashmint.service.js';

@Module({
	imports: [CashuWalletModule, ErrorModule],
	providers: [EcashMintResolver, EcashMintService],
})
export class EcashMintModule {}
