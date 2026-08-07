/* Core Dependencies */
import {Module} from '@nestjs/common';
// Orchard Endpoints
import {StatusModule} from './status/status.module.js';
// Auth Endpoints
import {AuthInitializationModule} from './auth/initialization/initialization.module.js';
import {AuthAuthenticationModule} from './auth/authentication/authentication.module.js';
import {AuthSignupModule} from './auth/signup/authsignup.module.js';
// Bitcoin Endpoints
import {BitcoinNetworkModule} from './bitcoin/network/btcnetwork.module.js';
import {BitcoinBlockchainModule} from './bitcoin/blockchain/btcblockchain.module.js';
import {BitcoinBlockModule} from './bitcoin/block/btcblock.module.js';
import {BitcoinMempoolModule} from './bitcoin/mempool/btcmempool.module.js';
import {BitcoinTransactionModule} from './bitcoin/transaction/btctransaction.module.js';
import {BitcoinOracleModule} from './bitcoin/oracle/btcoracle.module.js';
import {ApiBitcoinAnalyticsModule} from './bitcoin/analytics/btcanalytics.module.js';
// Lightning Endpoints
import {LightningInfoModule} from './lightning/info/lninfo.module.js';
import {LightningBalanceModule} from './lightning/balance/lnbalance.module.js';
import {LightningWalletModule} from './lightning/wallet/lnwallet.module.js';
import {LightningRequestModule} from './lightning/request/lnrequest.module.js';
import {LightningChannelModule} from './lightning/channel/lnchannel.module.js';
import {LightningPeerModule} from './lightning/peer/lnpeer.module.js';
import {ApiLightningAnalyticsModule} from './lightning/analytics/lnanalytics.module.js';
// Taproot Assets Endpoints
import {TaprootAssetsInfoModule} from './tapass/info/tapinfo.module.js';
import {TaprootAssetsAssetModule} from './tapass/asset/tapasset.module.js';
// Cashu Mint Endpoints
import {MintInfoModule} from './mint/info/mintinfo.module.js';
import {MintBalanceModule} from './mint/balance/mintbalance.module.js';
import {MintKeysetModule} from './mint/keyset/mintkeyset.module.js';
import {MintDatabaseModule} from './mint/database/mintdatabase.module.js';
import {MintQuoteModule} from './mint/quote/mintquote.module.js';
import {MintMeltQuoteModule} from './mint/meltquote/mintmeltquote.module.js';
import {MintMintQuoteModule} from './mint/mintquote/mintmintquote.module.js';
import {MintProofModule} from './mint/proof/mintproof.module.js';
import {MintSwapModule} from './mint/swap/mintswap.module.js';
import {MintAnalyticsModule} from './mint/analytics/mintanalytics.module.js';
import {MintCountModule} from './mint/count/mintcount.module.js';
import {MintWatchdogModule} from './mint/watchdog/mintwatchdog.module.js';
import {MintActivityModule} from './mint/activity/mintactivity.module.js';
import {ApiMintMetricsModule} from './mint/metrics/mintmetrics.module.js';
// AI Endpoints
import {AiModelModule} from './ai/model/aimodel.module.js';
import {AiAssistantModule} from './ai/assistant/aiassistant.module.js';
import {AiChatModule} from './ai/chat/aichat.module.js';
import {AiHealthModule} from './ai/health/aihealth.module.js';
import {AiAgentModule} from './ai/agent/aiagent.module.js';
import {AiToolsModule} from './ai/tools/aitools.module.js';
// Image Endpoints
import {PublicImageModule} from './public/image/image.module.js';
import {PublicUrlModule} from './public/url/url.module.js';
import {PublicPortModule} from './public/port/port.module.js';
// Crew Endpoints
import {CrewUserModule} from './crew/crewuser/crewuser.module.js';
import {CrewInviteModule} from './crew/crewinvite/crewinvite.module.js';
// Setting Endpoints
import {ApiSettingModule} from './setting/setting.module.js';
// Event Endpoints
import {ApiEventLogModule} from './event/event.module.js';
// System Endpoints
import {ApiSystemMetricsModule} from './system/metrics/sysmetrics.module.js';
import {ApiSystemInfoModule} from './system/info/sysinfo.module.js';
/* Enum Registration */
import './api.enums.js';

@Module({
	imports: [
		StatusModule,
		AuthInitializationModule,
		AuthAuthenticationModule,
		AuthSignupModule,
		BitcoinNetworkModule,
		BitcoinBlockchainModule,
		BitcoinBlockModule,
		BitcoinMempoolModule,
		BitcoinTransactionModule,
		BitcoinOracleModule,
		ApiBitcoinAnalyticsModule,
		LightningInfoModule,
		LightningBalanceModule,
		LightningWalletModule,
		LightningRequestModule,
		LightningChannelModule,
		LightningPeerModule,
		ApiLightningAnalyticsModule,
		TaprootAssetsInfoModule,
		TaprootAssetsAssetModule,
		MintInfoModule,
		MintBalanceModule,
		MintKeysetModule,
		MintDatabaseModule,
		MintQuoteModule,
		MintMeltQuoteModule,
		MintMintQuoteModule,
		MintProofModule,
		MintSwapModule,
		MintAnalyticsModule,
		MintCountModule,
		MintWatchdogModule,
		MintActivityModule,
		ApiMintMetricsModule,
		AiModelModule,
		AiAssistantModule,
		AiChatModule,
		AiHealthModule,
		AiAgentModule,
		AiToolsModule,
		PublicImageModule,
		PublicUrlModule,
		PublicPortModule,
		CrewUserModule,
		CrewInviteModule,
		ApiSettingModule,
		ApiEventLogModule,
		ApiSystemMetricsModule,
		ApiSystemInfoModule,
	],
})
export class ApiModule {}
