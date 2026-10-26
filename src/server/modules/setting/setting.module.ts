/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';

/* Local Dependencies */
import {SettingService} from './setting.service.js';
import {Setting} from './setting.entity.js';

@Module({
	imports: [TypeOrmModule.forFeature([Setting])],
	providers: [SettingService],
	exports: [SettingService],
})
export class SettingModule {}
