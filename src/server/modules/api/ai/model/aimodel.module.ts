/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {AiModule} from '#server/modules/ai/ai.module';
/* Internal Dependencies */
import {AiModelResolver} from './aimodel.resolver.js';
import {AiModelService} from './aimodel.service.js';

@Module({
	imports: [ErrorModule, AiModule],
	providers: [AiModelResolver, AiModelService],
})
export class AiModelModule {}
