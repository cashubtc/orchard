/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseModule} from '#server/modules/cashu/mintdb/cashumintdb.module';
import {MintService} from '#server/modules/api/mint/mint.service';
import {ErrorModule} from '#server/modules/error/error.module';
/* Local Dependencies */
import {MintCountService} from './mintcount.service.js';
import {MintCountResolver} from './mintcount.resolver.js';

@Module({
	imports: [CashuMintDatabaseModule, ErrorModule],
	providers: [MintCountResolver, MintCountService, MintService],
})
export class MintCountModule {}
