/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {LightningModule} from '#server/modules/lightning/lightning/lightning.module';
import {AnalyticsModule} from '#server/modules/analytics/analytics.module';
import {AnalyticsCheckpoint} from '#server/modules/analytics/analytics-checkpoint.entity';
import {BitcoinRpcModule} from '#server/modules/bitcoin/rpc/btcrpc.module';
/* Local Dependencies */
import {LightningAnalytics} from './lnanalytics.entity.js';
import {LightningAnalyticsService} from './lnanalytics.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([LightningAnalytics, AnalyticsCheckpoint]), LightningModule, AnalyticsModule, BitcoinRpcModule],
	providers: [LightningAnalyticsService],
	exports: [LightningAnalyticsService],
})
export class LightningAnalyticsModule {}
