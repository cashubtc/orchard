/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {LightningModule} from '#server/modules/lightning/lightning/lightning.module';
import {TaprootAssetsModule} from '#server/modules/tapass/tapass/tapass.module';
import {AnalyticsCheckpoint} from '#server/modules/analytics/analytics-checkpoint.entity';
/* Local Dependencies */
import {BitcoinAnalytics} from './btcanalytics.entity.js';
import {BitcoinAnalyticsService} from './btcanalytics.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([BitcoinAnalytics, AnalyticsCheckpoint]), LightningModule, TaprootAssetsModule],
	providers: [BitcoinAnalyticsService],
	exports: [BitcoinAnalyticsService],
})
export class BitcoinAnalyticsModule {}
