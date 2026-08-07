/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {EventLogModule} from '#server/modules/event/event.module';
import {SettingModule} from '#server/modules/setting/setting.module';
import {MessageModule} from '#server/modules/message/message.module';
/* Local Dependencies */
import {SettingResolver} from './setting.resolver.js';
import {ApiSettingService} from './setting.service.js';
import {SettingInterceptor} from './setting.interceptor.js';

@Module({
	imports: [ErrorModule, EventLogModule, SettingModule, MessageModule],
	providers: [SettingResolver, ApiSettingService, SettingInterceptor],
})
export class ApiSettingModule {}
