/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {CashuMintRpcModule} from '#server/modules/cashu/mintrpc/cashumintrpc.module';
/* Local Dependencies */
import {CashuWalletSeed} from './cashuwalletseed.entity.js';
import {CashuWalletCounter} from './cashuwalletcounter.entity.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletMint} from './cashuwalletmint.entity.js';
import {CashuWalletMintInfo} from './cashuwalletmintinfo.entity.js';
import {CashuWalletMintKeyset} from './cashuwalletmintkeyset.entity.js';
import {CashuWalletService} from './cashuwallet.service.js';
import {CashuWalletMintService} from './cashuwalletmint.service.js';
import {CashuWalletMintCacheService} from './cashuwalletmintcache.service.js';
import {CashuWalletOperationService} from './cashuwalletoperation.service.js';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			CashuWalletSeed,
			CashuWalletCounter,
			CashuWalletProof,
			CashuWalletOperation,
			CashuWalletMint,
			CashuWalletMintInfo,
			CashuWalletMintKeyset,
		]),
		FetchModule,
		CashuMintRpcModule,
	],
	providers: [CashuWalletService, CashuWalletMintService, CashuWalletMintCacheService, CashuWalletOperationService],
	exports: [CashuWalletService, CashuWalletMintService, CashuWalletOperationService],
})
export class CashuWalletModule {}
