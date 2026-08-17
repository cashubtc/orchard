/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {MessageModule} from '#server/modules/message/message.module';
import {MintMetricsModule} from '#server/modules/cashu/mintmetrics/mintmetrics.module';
/* Local Dependencies */
import {ToolService} from './tool.service.js';

@Module({
	imports: [MessageModule, MintMetricsModule],
	providers: [ToolService],
	exports: [ToolService],
})
export class ToolModule {}
