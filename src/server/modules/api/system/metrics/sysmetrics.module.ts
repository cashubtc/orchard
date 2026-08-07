/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
/* Native Dependencies */
import {SystemMetricsModule} from '@server/modules/system/metrics/sysmetrics.module';
/* Local Dependencies */
import {SystemMetricsResolver} from './sysmetrics.resolver.js';
import {ApiSystemMetricsService} from './sysmetrics.service.js';

@Module({
	imports: [SystemMetricsModule, ErrorModule],
	providers: [SystemMetricsResolver, ApiSystemMetricsService],
})
export class ApiSystemMetricsModule {}
