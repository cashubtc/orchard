/* Core Dependencies */
import {Module} from '@nestjs/common';

/* Application Dependencies */
import {CdkModule} from '#server/modules/cashu/cdk/cdk.module';

/* Native Dependencies */
import {FederationService} from './federation.service.js';

@Module({imports: [CdkModule], providers: [FederationService], exports: [FederationService]})
export class FederationModule {}
