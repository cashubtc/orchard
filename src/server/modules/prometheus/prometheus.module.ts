/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '@server/modules/fetch/fetch.module';
/* Local Dependencies */
import {PrometheusService} from './prometheus.service.js';

@Module({
	imports: [FetchModule],
	providers: [PrometheusService],
	exports: [PrometheusService],
})
export class PrometheusModule {}
