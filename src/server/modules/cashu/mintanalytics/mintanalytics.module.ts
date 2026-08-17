/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {CashuMintDatabaseModule} from '#server/modules/cashu/mintdb/cashumintdb.module';
import {CashuMintApiModule} from '#server/modules/cashu/mintapi/cashumintapi.module';
import {AnalyticsModule} from '#server/modules/analytics/analytics.module';
import {AnalyticsCheckpoint} from '#server/modules/analytics/analytics-checkpoint.entity';
/* Native Dependencies */
import {MintAnalytics} from './mintanalytics.entity.js';
import {CashuMintAnalyticsService} from './mintanalytics.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([MintAnalytics, AnalyticsCheckpoint]), CashuMintDatabaseModule, CashuMintApiModule, AnalyticsModule],
	providers: [CashuMintAnalyticsService],
	exports: [CashuMintAnalyticsService],
})
export class CashuMintAnalyticsModule {}
