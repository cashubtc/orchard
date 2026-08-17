/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseModule} from '#server/modules/cashu/mintdb/cashumintdb.module';
import {MintService} from '#server/modules/api/mint/mint.service';
import {ErrorModule} from '#server/modules/error/error.module';
/* Local Dependencies */
import {MintDatabaseResolver} from './mintdatabase.resolver.js';
import {MintDatabaseService} from './mintdatabase.service.js';

@Module({
	imports: [CashuMintDatabaseModule, ErrorModule],
	providers: [MintDatabaseResolver, MintDatabaseService, MintService],
})
export class MintDatabaseModule {}
