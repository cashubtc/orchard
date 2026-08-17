/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
/* Native Dependencies */
import {SystemInfoModule} from '#server/modules/system/info/sysinfo.module';
/* Local Dependencies */
import {SystemInfoResolver} from './sysinfo.resolver.js';
import {ApiSystemInfoService} from './sysinfo.service.js';

@Module({
	imports: [SystemInfoModule, ErrorModule],
	providers: [SystemInfoResolver, ApiSystemInfoService],
})
export class ApiSystemInfoModule {}
