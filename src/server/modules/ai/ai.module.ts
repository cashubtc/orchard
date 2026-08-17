/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {SettingModule} from '#server/modules/setting/setting.module';
/* Local Dependencies */
import {AiService} from './ai.service.js';
import {OllamaService} from './ollama/ollama.service.js';
import {OpenRouterService} from './openrouter/openrouter.service.js';

@Module({
	imports: [FetchModule, SettingModule],
	providers: [AiService, OllamaService, OpenRouterService],
	exports: [AiService],
})
export class AiModule {}
