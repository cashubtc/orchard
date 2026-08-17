/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {SettingModule} from '#server/modules/setting/setting.module';
/* Internal Dependencies */
import {AiHealthResolver} from './aihealth.resolver.js';
import {AiHealthService} from './aihealth.service.js';

@Module({
	imports: [ErrorModule, FetchModule, SettingModule],
	providers: [AiHealthResolver, AiHealthService],
})
export class AiHealthModule {}
