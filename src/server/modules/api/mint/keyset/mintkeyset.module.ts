/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseModule} from '@server/modules/cashu/mintdb/cashumintdb.module';
import {CashuMintAnalyticsModule} from '@server/modules/cashu/mintanalytics/mintanalytics.module';
import {CashuMintRpcModule} from '@server/modules/cashu/mintrpc/cashumintrpc.module';
import {ErrorModule} from '@server/modules/error/error.module';
import {EventLogModule} from '@server/modules/event/event.module';
import {MintService} from '@server/modules/api/mint/mint.service';
/* Local Dependencies */
import {MintKeysetService} from './mintkeyset.service.js';
import {MintKeysetResolver} from './mintkeyset.resolver.js';
import {MintKeysetInterceptor} from './mintkeyset.interceptor.js';

@Module({
	imports: [CashuMintDatabaseModule, CashuMintAnalyticsModule, CashuMintRpcModule, ErrorModule, EventLogModule],
	providers: [MintKeysetResolver, MintKeysetService, MintService, MintKeysetInterceptor],
})
export class MintKeysetModule {}
