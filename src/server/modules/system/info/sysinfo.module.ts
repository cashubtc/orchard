/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Local Dependencies */
import {SystemInfoService} from './sysinfo.service.js';

@Module({
	providers: [SystemInfoService],
	exports: [SystemInfoService],
})
export class SystemInfoModule {}
