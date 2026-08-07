/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ToolModule} from '@server/modules/ai/tools/tool.module';
/* Local Dependencies */
import {AiToolsResolver} from './aitools.resolver.js';
import {AiToolsService} from './aitools.service.js';

@Module({
	imports: [ToolModule],
	providers: [AiToolsResolver, AiToolsService],
})
export class AiToolsModule {}
