/* Core Dependencies */
import {Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {TypeOrmModule, getRepositoryToken} from '@nestjs/typeorm';
/* Application Dependencies */
import {
	SERVICE_NAMES,
	SERVICE_DEFINITIONS,
	SERVICE_ENVIRONMENT_KEY,
} from '#server/modules/service-config/constants/service-config.constants';
import {applyServiceSettings} from '#server/modules/service-config/helpers/service-config.helpers';
/* Local Dependencies */
import {SettingService} from './setting.service.js';
import {Setting} from './setting.entity.js';

@Module({
	imports: [TypeOrmModule.forFeature([Setting])],
	providers: [
		{
			provide: SettingService,
			inject: [getRepositoryToken(Setting), ConfigService],
			// Async providers finish before any integration lifecycle hooks run.
			useFactory: async (repository: Repository<Setting>, config: ConfigService): Promise<SettingService> => {
				const service = new SettingService(repository, config);
				if (process.env.SCHEMA_ONLY) return service;
				await service.onModuleInit();
				const environment = Object.fromEntries(
					SERVICE_NAMES.map((name) => [name, {...config.get(SERVICE_DEFINITIONS[name].group)}]),
				);
				config.set(SERVICE_ENVIRONMENT_KEY, environment);
				applyServiceSettings(config, await service.getSettings());
				return service;
			},
		},
	],
	exports: [SettingService],
})
export class SettingModule {}
