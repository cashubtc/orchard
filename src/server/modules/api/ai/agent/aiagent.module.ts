/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {EventLogModule} from '@server/modules/event/event.module';
import {AgentModule} from '@server/modules/ai/agent/agent.module';
/* Local Dependencies */
import {AiAgentResolver} from './aiagent.resolver.js';
import {AiAgentService} from './aiagent.service.js';
import {AiAgentInterceptor} from './aiagent.interceptor.js';

@Module({
	imports: [AgentModule, ErrorModule, EventLogModule],
	providers: [AiAgentResolver, AiAgentService, AiAgentInterceptor],
})
export class AiAgentModule {}
