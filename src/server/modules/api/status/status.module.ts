/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Local Dependencies */
import {StatusResolver} from './status.resolver.js';
import {StatusService} from './status.service.js';

@Module({
	providers: [StatusResolver, StatusService],
})
export class StatusModule {}
