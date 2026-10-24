/* Core Dependencies */
import {Module} from '@nestjs/common';

/* Application Dependencies */
import {FederationModule} from '#server/modules/federation/federation.module';
import {ErrorModule} from '#server/modules/error/error.module';

/* Local Dependencies */
import {FederationSetupResolver} from './federation-setup.resolver.js';
import {FederationResolver} from './federation.resolver.js';

@Module({imports: [FederationModule, ErrorModule], providers: [FederationResolver, FederationSetupResolver]})
export class ApiFederationModule {}
