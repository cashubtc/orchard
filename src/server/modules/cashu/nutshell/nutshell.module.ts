/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CredentialModule} from '#server/modules/credential/credential.module';
/* Local Dependencies */
import {NutshellService} from './nutshell.service.js';

@Module({
	imports: [CredentialModule],
	providers: [NutshellService],
	exports: [NutshellService],
})
export class NutshellModule {}
