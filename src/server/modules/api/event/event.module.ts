/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {EventLogModule} from '@server/modules/event/event.module';
/* Local Dependencies */
import {EventLogResolver} from './event.resolver.js';
import {ApiEventLogService} from './event.service.js';

@Module({
	imports: [ErrorModule, EventLogModule],
	providers: [EventLogResolver, ApiEventLogService],
})
export class ApiEventLogModule {}
