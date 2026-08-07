/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseModule} from '@server/modules/cashu/mintdb/cashumintdb.module';
import {CashuMintRpcModule} from '@server/modules/cashu/mintrpc/cashumintrpc.module';
import {CashuMintApiModule} from '@server/modules/cashu/mintapi/cashumintapi.module';
import {MintService} from '@server/modules/api/mint/mint.service';
import {ErrorModule} from '@server/modules/error/error.module';
import {EventLogModule} from '@server/modules/event/event.module';
/* Local Dependencies */
import {MintMintQuoteService} from './mintmintquote.service.js';
import {MintMintQuoteResolver} from './mintmintquote.resolver.js';
import {MintMintQuoteInterceptor} from './mintmintquote.interceptor.js';

@Module({
	imports: [CashuMintDatabaseModule, CashuMintRpcModule, CashuMintApiModule, ErrorModule, EventLogModule],
	providers: [MintMintQuoteResolver, MintMintQuoteService, MintService, MintMintQuoteInterceptor],
})
export class MintMintQuoteModule {}
