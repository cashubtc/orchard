/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '@server/modules/fetch/fetch.module';
/* Local Dependencies */
import {PublicUrlService} from './url.service.js';
import {PublicUrlResolver} from './url.resolver.js';

@Module({
	imports: [FetchModule],
	providers: [PublicUrlResolver, PublicUrlService],
})
export class PublicUrlModule {}
