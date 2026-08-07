/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseModule} from '@server/modules/cashu/mintdb/cashumintdb.module';
import {ErrorModule} from '@server/modules/error/error.module';
import {MintService} from '@server/modules/api/mint/mint.service';
/* Internal Dependencies */
import {MintBalanceResolver} from './mintbalance.resolver.js';
import {MintBalanceService} from './mintbalance.service.js';

@Module({
	imports: [CashuMintDatabaseModule, ErrorModule],
	providers: [MintBalanceResolver, MintBalanceService, MintService],
})
export class MintBalanceModule {}
