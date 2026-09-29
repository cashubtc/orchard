/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletModule} from '#server/modules/cashu/wallet/cashuwallet.module';
import {UserModule} from '#server/modules/user/user.module';
import {ErrorModule} from '#server/modules/error/error.module';
/* Local Dependencies */
import {EcashSeedResolver} from './ecashseed.resolver.js';
import {EcashSeedService} from './ecashseed.service.js';

@Module({
	imports: [CashuWalletModule, UserModule, ErrorModule],
	providers: [EcashSeedResolver, EcashSeedService],
})
export class EcashSeedModule {}
