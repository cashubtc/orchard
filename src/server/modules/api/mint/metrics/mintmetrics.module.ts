/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {SettingModule} from '@server/modules/setting/setting.module';
/* Native Dependencies */
import {MintMetricsModule} from '@server/modules/cashu/mintmetrics/mintmetrics.module';
/* Local Dependencies */
import {MintMetricsResolver} from './mintmetrics.resolver';
import {ApiMintMetricsService} from './mintmetrics.service';

@Module({
	imports: [MintMetricsModule, SettingModule, ErrorModule],
	providers: [MintMetricsResolver, ApiMintMetricsService],
})
export class ApiMintMetricsModule {}
