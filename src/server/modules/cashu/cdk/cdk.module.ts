/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CredentialModule} from '#server/modules/credential/credential.module';
/* Local Dependencies */
import {CdkService} from './cdk.service.js';

@Module({
	imports: [CredentialModule],
	providers: [CdkService],
	exports: [CdkService],
})
export class CdkModule {}
