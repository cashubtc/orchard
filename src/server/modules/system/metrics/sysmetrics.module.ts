/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Local Dependencies */
import {SystemMetrics} from './sysmetrics.entity.js';
import {SystemMetricsService} from './sysmetrics.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([SystemMetrics])],
	providers: [SystemMetricsService],
	exports: [SystemMetricsService],
})
export class SystemMetricsModule {}
