/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
/* Local Dependencies */
import {CashuWalletSeed} from './cashuwalletseed.entity.js';
import {CashuWalletCounter} from './cashuwalletcounter.entity.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletMint} from './cashuwalletmint.entity.js';
import {CashuWalletService} from './cashuwallet.service.js';
import {CashuWalletMintService} from './cashuwalletmint.service.js';
import {CashuWalletOperationService} from './cashuwalletoperation.service.js';

@Module({
	imports: [
		TypeOrmModule.forFeature([CashuWalletSeed, CashuWalletCounter, CashuWalletProof, CashuWalletOperation, CashuWalletMint]),
		FetchModule,
	],
	providers: [CashuWalletService, CashuWalletMintService, CashuWalletOperationService],
	exports: [CashuWalletService, CashuWalletMintService, CashuWalletOperationService],
})
export class CashuWalletModule {}
