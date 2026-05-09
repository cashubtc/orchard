/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseModule} from '@server/modules/cashu/mintdb/cashumintdb.module';
import {ErrorModule} from '@server/modules/error/error.module';
import {MintService} from '@server/modules/api/mint/mint.service';
/* Internal Dependencies */
import {MintWatchdogResolver} from './mintwatchdog.resolver';
import {MintWatchdogService} from './mintwatchdog.service';

@Module({
	imports: [CashuMintDatabaseModule, ErrorModule],
	providers: [MintWatchdogResolver, MintWatchdogService, MintService],
})
export class MintWatchdogModule {}
