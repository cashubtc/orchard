/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintAnalyticsModule} from '@server/modules/cashu/mintanalytics/mintanalytics.module';
import {ErrorModule} from '@server/modules/error/error.module';
/* Local Dependencies */
import {MintAnalyticsResolver} from './mintanalytics.resolver.js';
import {MintAnalyticsService} from './mintanalytics.service.js';

@Module({
	imports: [CashuMintAnalyticsModule, ErrorModule],
	providers: [MintAnalyticsResolver, MintAnalyticsService],
})
export class MintAnalyticsModule {}
