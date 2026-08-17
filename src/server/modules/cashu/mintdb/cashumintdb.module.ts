/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CredentialModule} from '#server/modules/credential/credential.module';
import {NutshellModule} from '#server/modules/cashu/nutshell/nutshell.module';
import {CdkModule} from '#server/modules/cashu/cdk/cdk.module';
/* Local Dependencies */
import {CashuMintDatabaseService} from './cashumintdb.service.js';

@Module({
	imports: [CredentialModule, NutshellModule, CdkModule],
	providers: [CashuMintDatabaseService],
	exports: [CashuMintDatabaseService],
})
export class CashuMintDatabaseModule {}
