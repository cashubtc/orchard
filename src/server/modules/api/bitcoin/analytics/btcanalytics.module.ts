/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
/* Native Dependencies */
import {BitcoinAnalyticsModule} from '@server/modules/bitcoin/analytics/btcanalytics.module';
/* Local Dependencies */
import {BitcoinAnalyticsResolver} from './btcanalytics.resolver.js';
import {ApiBitcoinAnalyticsService} from './btcanalytics.service.js';

@Module({
	imports: [BitcoinAnalyticsModule, ErrorModule],
	providers: [BitcoinAnalyticsResolver, ApiBitcoinAnalyticsService],
})
export class ApiBitcoinAnalyticsModule {}
