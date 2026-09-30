/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {CashuMintRpcModule} from '#server/modules/cashu/mintrpc/cashumintrpc.module';
/* Local Dependencies */
import {CashuWalletSeed} from './seed/cashuwalletseed.entity.js';
import {CashuWalletCounter} from './saga/cashuwalletcounter.entity.js';
import {CashuWalletProof} from './proof/cashuwalletproof.entity.js';
import {CashuWalletOperation} from './saga/cashuwalletoperation.entity.js';
import {CashuWalletMint} from './mint/cashuwalletmint.entity.js';
import {CashuWalletMintInfo} from './mint/cashuwalletmintinfo.entity.js';
import {CashuWalletMintKeyset} from './mint/cashuwalletmintkeyset.entity.js';
import {CashuWalletService} from './cashuwallet.service.js';
import {CashuWalletMintService} from './mint/cashuwalletmint.service.js';
import {CashuWalletMintCacheService} from './mint/cashuwalletmintcache.service.js';
import {CashuWalletOperationService} from './saga/cashuwalletoperation.service.js';

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
