/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
/* Local Dependencies */
import {CashuMintApiService} from './cashumintapi.service.js';

@Module({
	imports: [FetchModule],
	providers: [CashuMintApiService],
	exports: [CashuMintApiService],
})
export class CashuMintApiModule {}
