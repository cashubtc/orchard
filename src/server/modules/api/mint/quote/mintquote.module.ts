/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintRpcModule} from '@server/modules/cashu/mintrpc/cashumintrpc.module';
import {ErrorModule} from '@server/modules/error/error.module';
import {EventLogModule} from '@server/modules/event/event.module';
/* Local Dependencies */
import {MintQuoteService} from './mintquote.service.js';
import {MintQuoteResolver} from './mintquote.resolver.js';
import {MintQuoteInterceptor} from './mintquote.interceptor.js';

@Module({
	imports: [CashuMintRpcModule, ErrorModule, EventLogModule],
	providers: [MintQuoteResolver, MintQuoteService, MintQuoteInterceptor],
})
export class MintQuoteModule {}
