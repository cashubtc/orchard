/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Local Dependencies */
import {CashuWalletSeed} from './cashuwalletseed.entity.js';
import {CashuWalletCounter} from './cashuwalletcounter.entity.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletService} from './cashuwallet.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([CashuWalletSeed, CashuWalletCounter, CashuWalletProof, CashuWalletOperation])],
	providers: [CashuWalletService],
	exports: [CashuWalletService],
})
export class CashuWalletModule {}
