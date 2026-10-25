/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ServiceConfigModule} from '#server/modules/service-config/service-config.module';
/* Local Dependencies */
import {ServiceConfigResolver} from './service-config.resolver.js';

@Module({imports: [ServiceConfigModule], providers: [ServiceConfigResolver]})
export class ApiServiceConfigModule {}
