/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {SettingModule} from '@server/modules/setting/setting.module';
import {UserModule} from '@server/modules/user/user.module';
/* Local Dependencies */
import {TelegramService} from './telegram.service.js';

@Module({
	imports: [SettingModule, UserModule],
	providers: [TelegramService],
	exports: [TelegramService],
})
export class TelegramModule {}
