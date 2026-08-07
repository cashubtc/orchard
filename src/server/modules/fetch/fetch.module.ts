/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Local Dependencies */
import {FetchService} from './fetch.service.js';

@Module({
	providers: [FetchService],
	exports: [FetchService],
})
export class FetchModule {}
