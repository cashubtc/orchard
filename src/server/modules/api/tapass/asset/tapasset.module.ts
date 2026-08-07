/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {TaprootAssetsModule} from '@server/modules/tapass/tapass/tapass.module';
/* Local Dependencies */
import {TaprootAssetsAssetService} from './tapasset.service.js';
import {TaprootAssetsAssetResolver} from './tapasset.resolver.js';

@Module({
	imports: [TaprootAssetsModule, ErrorModule],
	providers: [TaprootAssetsAssetService, TaprootAssetsAssetResolver],
})
export class TaprootAssetsAssetModule {}
