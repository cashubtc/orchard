/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {CdkModule} from '#server/modules/cashu/cdk/cdk.module';
import {NutshellModule} from '#server/modules/cashu/nutshell/nutshell.module';
/* Local Dependencies */
import {CashuMintRpcService} from './cashumintrpc.service.js';

@Module({
	imports: [FetchModule, CdkModule, NutshellModule],
	providers: [CashuMintRpcService],
	exports: [CashuMintRpcService],
})
export class CashuMintRpcModule {}
