/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintAnalyticsModule} from '@server/modules/cashu/mintanalytics/mintanalytics.module';
import {ErrorModule} from '@server/modules/error/error.module';
/* Internal Dependencies */
import {MintActivityResolver} from './mintactivity.resolver.js';
import {MintActivityService} from './mintactivity.service.js';

@Module({
	imports: [CashuMintAnalyticsModule, ErrorModule],
	providers: [MintActivityResolver, MintActivityService],
})
export class MintActivityModule {}
