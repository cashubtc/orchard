/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
/* Native Dependencies */
import {SystemInfoModule} from '@server/modules/system/info/sysinfo.module';
/* Local Dependencies */
import {SystemInfoResolver} from './sysinfo.resolver';
import {ApiSystemInfoService} from './sysinfo.service';

@Module({
	imports: [SystemInfoModule, ErrorModule],
	providers: [SystemInfoResolver, ApiSystemInfoService],
})
export class ApiSystemInfoModule {}
