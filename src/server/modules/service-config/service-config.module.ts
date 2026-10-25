/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {MintMetricsModule} from '#server/modules/cashu/mintmetrics/mintmetrics.module';
import {SettingModule} from '#server/modules/setting/setting.module';
import {FetchModule} from '#server/modules/fetch/fetch.module';
import {CredentialModule} from '#server/modules/credential/credential.module';
import {BitcoinRpcModule} from '#server/modules/bitcoin/rpc/btcrpc.module';
import {LightningModule} from '#server/modules/lightning/lightning/lightning.module';
import {LightningWalletKitModule} from '#server/modules/lightning/walletkit/lnwalletkit.module';
import {CashuMintRpcModule} from '#server/modules/cashu/mintrpc/cashumintrpc.module';
import {CashuMintDatabaseModule} from '#server/modules/cashu/mintdb/cashumintdb.module';
import {CdkModule} from '#server/modules/cashu/cdk/cdk.module';
import {BitcoinAnalyticsModule} from '#server/modules/bitcoin/analytics/btcanalytics.module';
import {LightningAnalyticsModule} from '#server/modules/lightning/analytics/lnanalytics.module';
import {CashuMintAnalyticsModule} from '#server/modules/cashu/mintanalytics/mintanalytics.module';
/* Native Dependencies */
import {ServiceConfigService} from './service-config.service.js';
import {ServiceTestService} from './service-test.service.js';

@Module({
	imports: [
		MintMetricsModule,
		SettingModule,
		FetchModule,
		CredentialModule,
		BitcoinRpcModule,
		LightningModule,
		LightningWalletKitModule,
		CashuMintRpcModule,
		CashuMintDatabaseModule,
		CdkModule,
		BitcoinAnalyticsModule,
		LightningAnalyticsModule,
		CashuMintAnalyticsModule,
	],
	providers: [ServiceConfigService, ServiceTestService],
	exports: [ServiceConfigService],
})
export class ServiceConfigModule {}
