/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {AiModule} from '@server/modules/ai/ai.module';
import {SettingModule} from '@server/modules/setting/setting.module';
import {ToolModule} from '@server/modules/ai/tools/tool.module';
import {MintMetricsModule} from '@server/modules/cashu/mintmetrics/mintmetrics.module';
/* Local Dependencies */
import {Agent} from './agent.entity';
import {AgentRun} from './agent-run.entity';
import {AgentService} from './agent.service';

@Module({
	imports: [TypeOrmModule.forFeature([Agent, AgentRun]), AiModule, SettingModule, ToolModule, MintMetricsModule],
	providers: [AgentService],
	exports: [AgentService],
})
export class AgentModule {}
