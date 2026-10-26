/* Core Dependencies */
import {Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

/* Application Dependencies */
import {MintMetricsModule} from '#server/modules/cashu/mintmetrics/mintmetrics.module';
import {SettingService} from '#server/modules/setting/setting.service';
import {ClnModule} from '#server/modules/lightning/cln/cln.module';
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
import {
	SERVICE_NAMES,
	SERVICE_DEFINITIONS,
	SERVICE_ENVIRONMENT_KEY,
	SERVICE_SETTING_KEYS,
} from '#server/modules/service-config/constants/service-config.constants';
import {applyServiceSettings} from '#server/modules/service-config/helpers/service-config.helpers';
import type {IntegrationConfig} from '#server/modules/service-config/types/service-config.types';

/* Local Dependencies */
import {ServiceConfigService} from './service-config.service.js';
import {ServiceTestService} from './service-test.service.js';

export const SERVICE_CONFIG_BOOTSTRAP = {
	provide: 'SERVICE_CONFIG_BOOTSTRAP',
	inject: [SettingService, ConfigService],
	/** Apply decrypted overrides before integration lifecycle hooks initialize their connections. */
	useFactory: async (settings: SettingService, config: ConfigService): Promise<boolean> => {
		if (process.env.SCHEMA_ONLY) return false;
		await settings.onModuleInit();
		const environment = Object.fromEntries(
			SERVICE_NAMES.map((name) => [name, {...config.get<IntegrationConfig>(SERVICE_DEFINITIONS[name].group)}]),
		);
		config.set(SERVICE_ENVIRONMENT_KEY, environment);
		applyServiceSettings(config, await settings.getSettings([...SERVICE_SETTING_KEYS]));
		return true;
	},
};

@Module({
	imports: [
		MintMetricsModule,
		SettingModule,
		FetchModule,
		CredentialModule,
		BitcoinRpcModule,
		LightningModule,
		ClnModule,
		LightningWalletKitModule,
		CashuMintRpcModule,
		CashuMintDatabaseModule,
		CdkModule,
		BitcoinAnalyticsModule,
		LightningAnalyticsModule,
		CashuMintAnalyticsModule,
	],
	providers: [SERVICE_CONFIG_BOOTSTRAP, ServiceConfigService, ServiceTestService],
	exports: [ServiceConfigService],
})
export class ServiceConfigModule {}
