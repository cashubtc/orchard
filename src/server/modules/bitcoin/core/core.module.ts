/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '@server/modules/fetch/fetch.module';
/* Local Dependencies */
import {CoreService} from './core.service.js';

@Module({
	imports: [FetchModule],
	providers: [CoreService],
	exports: [CoreService],
})
export class CoreModule {}
