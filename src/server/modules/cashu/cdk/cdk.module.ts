/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CredentialModule} from '#server/modules/credential/credential.module';
/* Local Dependencies */
import {CdkRpcService} from './cdkrpc.service.js';
import {CdkService} from './cdk.service.js';

@Module({
	imports: [CredentialModule],
	providers: [CdkService, CdkRpcService],
	exports: [CdkService, CdkRpcService],
})
export class CdkModule {}
