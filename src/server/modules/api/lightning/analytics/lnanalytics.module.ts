/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
/* Native Dependencies */
import {LightningAnalyticsModule} from '#server/modules/lightning/analytics/lnanalytics.module';
/* Local Dependencies */
import {LightningAnalyticsResolver} from './lnanalytics.resolver.js';
import {ApiLightningAnalyticsService} from './lnanalytics.service.js';

@Module({
	imports: [LightningAnalyticsModule, ErrorModule],
	providers: [LightningAnalyticsResolver, ApiLightningAnalyticsService],
})
export class ApiLightningAnalyticsModule {}
