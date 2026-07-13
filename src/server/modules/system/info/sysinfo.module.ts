/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Local Dependencies */
import {SystemInfoService} from './sysinfo.service';

@Module({
	providers: [SystemInfoService],
	exports: [SystemInfoService],
})
export class SystemInfoModule {}
