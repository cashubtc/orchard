/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Local Dependencies */
import {TelegramModule} from './telegram/telegram.module.js';
import {MessageService} from './message.service.js';

@Module({
	imports: [TelegramModule],
	providers: [MessageService],
	exports: [MessageService],
})
export class MessageModule {}
