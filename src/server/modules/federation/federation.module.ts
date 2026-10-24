/* Core Dependencies */
import {Module} from '@nestjs/common';

/* Application Dependencies */
import {CdkModule} from '#server/modules/cashu/cdk/cdk.module';

/* Native Dependencies */
import {FederationSetupService} from './federation-setup.service.js';
import {FederationService} from './federation.service.js';

@Module({
	imports: [CdkModule],
	providers: [FederationService, FederationSetupService],
	exports: [FederationService, FederationSetupService],
})
export class FederationModule {}
