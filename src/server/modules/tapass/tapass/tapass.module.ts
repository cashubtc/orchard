/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {TapdModule} from '#server/modules/tapass/tapd/tapd.module';
/* Local Dependencies */
import {TaprootAssetsService} from './tapass.service.js';

@Module({
	imports: [FetchModule, TapdModule],
	providers: [TaprootAssetsService],
	exports: [TaprootAssetsService],
})
export class TaprootAssetsModule {}
