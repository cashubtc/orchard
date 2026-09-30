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
import {CashuWalletSeedService} from './seed/cashuwalletseed.service.js';
import {CashuWalletProofService} from './proof/cashuwalletproof.service.js';
import {CashuWalletMintService} from './mint/cashuwalletmint.service.js';
import {CashuWalletMintCacheService} from './mint/cashuwalletmintcache.service.js';
import {CashuWalletMintTransportService} from './mint/cashuwalletminttransport.service.js';
import {CashuWalletJournalService} from './saga/cashuwalletjournal.service.js';
import {CashuWalletRecoveryService} from './saga/cashuwalletrecovery.service.js';
import {CashuWalletOperationService} from './saga/cashuwalletoperation.service.js';
import {CashuWalletIssueService} from './saga/issue/cashuwalletissue.service.js';

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
	providers: [
		CashuWalletSeedService,
		CashuWalletProofService,
		CashuWalletMintService,
		CashuWalletMintCacheService,
		CashuWalletMintTransportService,
		CashuWalletJournalService,
		CashuWalletRecoveryService,
		CashuWalletOperationService,
		CashuWalletIssueService,
	],
	exports: [
		CashuWalletSeedService,
		CashuWalletProofService,
		CashuWalletMintService,
		CashuWalletRecoveryService,
		CashuWalletOperationService,
		CashuWalletIssueService,
	],
})
export class CashuWalletModule {}
