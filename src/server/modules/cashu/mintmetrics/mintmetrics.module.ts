/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {PrometheusModule} from '@server/modules/prometheus/prometheus.module';
import {SettingModule} from '@server/modules/setting/setting.module';
/* Local Dependencies */
import {MintMetrics} from './mintmetrics.entity';
import {MintMetricsService} from './mintmetrics.service';

@Module({
	imports: [TypeOrmModule.forFeature([MintMetrics]), PrometheusModule, SettingModule],
	providers: [MintMetricsService],
	exports: [MintMetricsService],
})
export class MintMetricsModule {}
