/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {AuthModule} from '#server/modules/auth/auth.module';
import {SettingModule} from '#server/modules/setting/setting.module';
import {BitcoinUTXOracleModule} from '#server/modules/bitcoin/utxoracle/utxoracle.module';
import {BitcoinRpcModule} from '#server/modules/bitcoin/rpc/btcrpc.module';
import {LightningAnalyticsModule} from '#server/modules/lightning/analytics/lnanalytics.module';
import {BitcoinAnalyticsModule} from '#server/modules/bitcoin/analytics/btcanalytics.module';
import {CashuMintAnalyticsModule} from '#server/modules/cashu/mintanalytics/mintanalytics.module';
import {AgentModule} from '#server/modules/ai/agent/agent.module';
import {ConversationModule} from '#server/modules/ai/conversation/conversation.module';
import {SystemMetricsModule} from '#server/modules/system/metrics/sysmetrics.module';
import {MintMetricsModule} from '#server/modules/cashu/mintmetrics/mintmetrics.module';
/* Local Dependencies */
import {TaskService} from './task.service.js';

@Module({
	imports: [
		AuthModule,
		SettingModule,
		BitcoinUTXOracleModule,
		BitcoinRpcModule,
		LightningAnalyticsModule,
		BitcoinAnalyticsModule,
		CashuMintAnalyticsModule,
		AgentModule,
		ConversationModule,
		SystemMetricsModule,
		MintMetricsModule,
	],
	providers: [TaskService],
})
export class TaskModule {}
