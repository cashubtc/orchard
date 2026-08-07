/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
/* Local Dependencies */
import {EventLog} from './event.entity.js';
import {EventLogDetail} from './event-detail.entity.js';
import {EventLogService} from './event.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([EventLog, EventLogDetail])],
	providers: [EventLogService],
	exports: [EventLogService],
})
export class EventLogModule {}
