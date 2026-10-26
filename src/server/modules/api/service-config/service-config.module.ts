/* Core Dependencies */
import {Module} from '@nestjs/common';

/* Application Dependencies */
import {ServiceConfigModule} from '#server/modules/service-config/service-config.module';
import {ErrorModule} from '#server/modules/error/error.module';
import {EventLogModule} from '#server/modules/event/event.module';

/* Local Dependencies */
import {ServiceConfigResolver} from './service-config.resolver.js';

@Module({imports: [ServiceConfigModule, ErrorModule, EventLogModule], providers: [ServiceConfigResolver]})
export class ApiServiceConfigModule {}
