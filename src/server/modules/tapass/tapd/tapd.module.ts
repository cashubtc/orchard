/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CredentialModule} from '@server/modules/credential/credential.module';
/* Local Dependencies */
import {TapdService} from './tapd.service.js';

@Module({
	imports: [CredentialModule],
	providers: [TapdService],
	exports: [TapdService],
})
export class TapdModule {}
