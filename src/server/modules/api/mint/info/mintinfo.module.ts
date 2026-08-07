/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintApiModule} from '#server/modules/cashu/mintapi/cashumintapi.module';
import {CashuMintRpcModule} from '#server/modules/cashu/mintrpc/cashumintrpc.module';
import {ErrorModule} from '#server/modules/error/error.module';
import {EventLogModule} from '#server/modules/event/event.module';
/* Local Dependencies */
import {MintInfoService} from './mintinfo.service.js';
import {MintInfoResolver} from './mintinfo.resolver.js';
import {MintInfoInterceptor} from './mintinfo.interceptor.js';

@Module({
	imports: [CashuMintApiModule, CashuMintRpcModule, ErrorModule, EventLogModule],
	providers: [MintInfoResolver, MintInfoService, MintInfoInterceptor],
})
export class MintInfoModule {}
