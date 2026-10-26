/* Core Dependencies */
import {Module} from '@nestjs/common';

/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {CdkModule} from '#server/modules/cashu/cdk/cdk.module';

/* Native Dependencies */
import {FederationSettingsService} from './federation-settings.service.js';
import {FederationSetupService} from './federation-setup.service.js';
import {FederationService} from './federation.service.js';

@Module({
	imports: [CdkModule, FetchModule],
	providers: [FederationService, FederationSetupService, FederationSettingsService],
	exports: [FederationService, FederationSetupService, FederationSettingsService],
})
export class FederationModule {}
